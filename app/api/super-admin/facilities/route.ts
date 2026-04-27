/**
 * GET  /api/super-admin/facilities — 처리시설 목록 (지자체 단위)
 *   query: ?active=true&municipalityId=N (SUPER_ADMIN 옵션) | ?contractorId=N (역호환)
 * POST /api/super-admin/facilities — 신규 등록 (지자체 단위)
 *   body: { type, name, address?, municipalityId? (SUPER_ADMIN 전용) }
 *
 * Design Ref: §3.1.1 — 처리시설은 지자체 단위. 같은 지자체 산하 위탁업체는 자동으로 동일 목록 사용.
 * 권한: GET = SUPER_ADMIN/INTERNAL_ADMIN/CONTRACTOR_ADMIN/MUNI_ADMIN
 *      POST = SUPER_ADMIN, MUNI_ADMIN(자기 지자체만)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { FACILITY_TYPES, isFacilityType } from '@/lib/facility';

export const runtime = 'nodejs';

const CreateBody = z.object({
  type: z.string().refine(isFacilityType, { message: 'invalid_type' }),
  name: z.string().min(1).max(100),
  address: z.string().max(255).nullable().optional(),
  municipalityId: z.string().optional(),  // SUPER_ADMIN 전용
  /* 역호환 — 일부 기존 클라이언트는 contractorId 로 전달. 무시하되 음 처리. */
  contractorId: z.string().optional(),
});

/** 사용자의 가시 가능한 지자체 ID 목록 */
async function visibleMunicipalityIds(session: {
  role: string;
  contractorId: string | null;
  municipalityId: string | null;
}): Promise<bigint[] | 'all' | 'none'> {
  if (session.role === 'SUPER_ADMIN') return 'all';
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return [BigInt(session.municipalityId)];
  }
  if (session.contractorId) {
    /* CONTRACTOR_ADMIN/INTERNAL_ADMIN/WORKER — 본인 contractor의 muni */
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true },
    });
    if (!c?.municipalityId) return 'none';
    return [c.municipalityId];
  }
  return 'none';
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const allowed = ['SUPER_ADMIN', 'INTERNAL_ADMIN', 'CONTRACTOR_ADMIN', 'MUNI_ADMIN', 'WORKER'];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const onlyActive = url.searchParams.get('active') === 'true';
  const queryMuniId = url.searchParams.get('municipalityId');

  const visible = await visibleMunicipalityIds(session);
  if (visible === 'none') return NextResponse.json({ error: 'no_scope' }, { status: 403 });

  let where: { municipalityId?: bigint | { in: bigint[] }; active?: boolean } = {};
  if (visible === 'all') {
    if (queryMuniId) where.municipalityId = BigInt(queryMuniId);
  } else if (queryMuniId && visible.some((id) => id === BigInt(queryMuniId))) {
    where.municipalityId = BigInt(queryMuniId);
  } else {
    where.municipalityId = { in: visible };
  }
  if (onlyActive) where.active = true;

  const items = await prisma.wasteTreatmentFacility.findMany({
    where,
    include: { municipality: { select: { id: true, name: true, region: true } } },
    orderBy: [{ active: 'desc' }, { type: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    items: items.map((f) => ({
      id: f.id.toString(),
      municipalityId: f.municipalityId.toString(),
      municipalityName: f.municipality.name,
      municipalityRegion: f.municipality.region,
      type: f.type,
      name: f.name,
      address: f.address,
      active: f.active,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    types: FACILITY_TYPES,
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  /* SUPER_ADMIN 또는 MUNI_ADMIN 만 등록 가능 (CONTRACTOR_ADMIN/INTERNAL_ADMIN 은 muni 단위 변경 권한 없음) */
  const allowed = ['SUPER_ADMIN', 'MUNI_ADMIN'];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  /* 대상 지자체 결정 */
  let municipalityId: bigint | null = null;
  if (session.role === 'SUPER_ADMIN') {
    if (!b.municipalityId) return NextResponse.json({ error: 'municipality_required' }, { status: 400 });
    municipalityId = BigInt(b.municipalityId);
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    municipalityId = BigInt(session.municipalityId);
  }
  if (!municipalityId) return NextResponse.json({ error: 'no_scope' }, { status: 403 });

  /* duplicate_facility — UNIQUE [municipalityId, type, name] */
  const existing = await prisma.wasteTreatmentFacility.findFirst({
    where: { municipalityId, type: b.type, name: b.name },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'duplicate_facility' }, { status: 400 });

  const created = await prisma.wasteTreatmentFacility.create({
    data: {
      municipalityId,
      type: b.type,
      name: b.name,
      address: b.address ?? null,
      active: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'FACILITY_CREATE',
      resourceType: 'waste_treatment_facility',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { type: b.type, name: b.name, municipalityId: municipalityId.toString() } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() });
}
