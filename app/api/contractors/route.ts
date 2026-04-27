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

  const where: { status?: 'ACTIVE'; municipalityId?: bigint; id?: bigint } = {};
  if (onlyActive) where.status = 'ACTIVE';

  if (session.role === 'SUPER_ADMIN') {
    /* 전체 */
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    where.municipalityId = BigInt(session.municipalityId);
  } else if (session.contractorId) {
    where.id = BigInt(session.contractorId);
  } else {
    return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
  }

  const items = await prisma.contractor.findMany({
    where,
    include: { municipality: { select: { id: true, name: true } } },
    orderBy: [{ companyName: 'asc' }],
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id.toString(),
      companyName: c.companyName,
      businessNo: c.businessNo,
      status: c.status,
      active: c.status === 'ACTIVE',
      municipalityName: c.municipality?.name ?? null,
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
    select: { id: true, name: true },
  });
  if (!muni) return NextResponse.json({ error: 'municipality_not_found' }, { status: 400 });

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

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_CREATE',
      resourceType: 'contractor',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { companyName: b.companyName, municipality: muni.name } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    id: created.id.toString(),
    companyName: created.companyName,
  });
}
