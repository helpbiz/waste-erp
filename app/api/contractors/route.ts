/**
 * GET  /api/contractors?active=true — 위탁업체 목록 (권한별 가시범위)
 * POST /api/contractors — 위탁업체 신규 등록 (SUPER_ADMIN 전용)
 *
 * Plan SC: F-02 PDF 다운로드 시 위탁업체 선택용 (SUPER_ADMIN, MUNI_ADMIN)
 *  - SUPER_ADMIN: 전체
 *  - MUNI_ADMIN: 자기 관할 지자체 산하만
 *  - 기타: 자사만
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const CreateBody = z.object({
  municipalityId: z.string().min(1),
  companyName: z.string().min(1).max(100),
  businessNo: z.string().min(1).max(20),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  contractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['SETUP', 'ACTIVE', 'EXPIRED']).optional(),
  ceoName: z.string().max(50).optional().nullable(),
  phoneMain: z.string().max(20).optional().nullable(),
  emailMain: z.string().max(100).optional().nullable(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const onlyActive = url.searchParams.get('active') === 'true';
  const queryMuniId = url.searchParams.get('municipalityId');
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const onlyDeleted = url.searchParams.get('onlyDeleted') === 'true';

  /* §8 Q4=B soft-delete 기본 필터: deletedAt=null 만 노출.
     ?onlyDeleted=true: 휴지통 전용
     ?includeDeleted=true: 모두 노출 (정상 + 휴지통) */
  const where: { status?: 'ACTIVE'; municipalityId?: bigint; id?: bigint; deletedAt?: null | { not: null } } = {};
  if (onlyActive) where.status = 'ACTIVE';
  if (onlyDeleted) where.deletedAt = { not: null };
  else if (!includeDeleted) where.deletedAt = null;

  if (session.role === 'SUPER_ADMIN') {
    /* SUPER_ADMIN — ?municipalityId 옵션으로 특정 지자체만 필터 */
    if (queryMuniId) where.municipalityId = BigInt(queryMuniId);
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    where.municipalityId = BigInt(session.municipalityId);
  } else if (session.contractorId) {
    where.id = BigInt(session.contractorId);
  } else {
    return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
  }

  const items = await prisma.contractor.findMany({
    where,
    include: { municipality: { select: { id: true, name: true, region: true } } },
    orderBy: [{ companyName: 'asc' }],
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id.toString(),
      companyName: c.companyName,
      businessNo: c.businessNo,
      status: c.status,
      active: c.status === 'ACTIVE',
      deletedAt: c.deletedAt?.toISOString() ?? null,
      municipalityId: c.municipality?.id?.toString() ?? null,
      municipalityName: c.municipality?.name ?? null,
      municipalityRegion: c.municipality?.region ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  /* 사업자번호 중복 검사 */
  const existing = await prisma.contractor.findUnique({
    where: { businessNo: b.businessNo },
    select: { id: true, companyName: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'duplicate_business_no', detail: `이미 등록된 사업자번호 (${existing.companyName})` },
      { status: 400 },
    );
  }

  /* 지자체 존재 확인 */
  const muni = await prisma.municipality.findUnique({
    where: { id: BigInt(b.municipalityId) },
    select: { id: true, name: true, status: true },
  });
  if (!muni) return NextResponse.json({ error: 'municipality_not_found' }, { status: 400 });

  /* SUSPENDED (시드만 된 미운영) 지자체에 위탁업체가 등록되면 자동으로 ACTIVE 승급.
     사용자 요청 2026-04-29: 용산구 검색 안 되던 원인 (status=ACTIVE 필터)을
     해결하면서 새 위탁업체 추가 시 muni 상태도 자연 정합성 있게 갱신. */
  if (muni.status === 'SUSPENDED') {
    await prisma.municipality.update({
      where: { id: muni.id },
      data: { status: 'ACTIVE' },
    });
  }

  const created = await prisma.contractor.create({
    data: {
      municipalityId: muni.id,
      companyName: b.companyName,
      businessNo: b.businessNo,
      contractStart: b.contractStart ? new Date(b.contractStart + 'T00:00:00Z') : null,
      contractEnd: b.contractEnd ? new Date(b.contractEnd + 'T00:00:00Z') : null,
      status: b.status ?? 'SETUP',
      ceoName: b.ceoName ?? null,
      phoneMain: b.phoneMain ?? null,
      emailMain: b.emailMain ?? null,
    },
  });

  /* SUPER cross-tenant — 신규 contractor의 muni 명시 기록 */
  await writeAudit(req, session, {
    action: 'CONTRACTOR_CREATE',
    resourceType: 'contractor',
    resourceId: created.id.toString(),
    contractorId: created.id,
    municipalityId: muni.id,
    metadata: {
      companyName: b.companyName,
      municipality: muni.name,
      crossTenant: true,
    },
  });

  return NextResponse.json({
    ok: true,
    id: created.id.toString(),
    companyName: created.companyName,
  });
}
