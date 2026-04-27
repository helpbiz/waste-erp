/**
 * GET  /api/super-admin/facilities — 처리시설 목록 (자사 또는 SUPER_ADMIN의 경우 contractorId 지정)
 * POST /api/super-admin/facilities — 신규 등록
 *   body: { type, name, address?, contractorId? (SUPER_ADMIN 전용) }
 *
 * Design Ref: §4.1, §4.2 — F-02 일일 처리실적 일보 처리시설 마스터
 * 권한: SUPER_ADMIN, INTERNAL_ADMIN, CONTRACTOR_ADMIN (자사 scope)
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
  contractorId: z.string().optional(),  // SUPER_ADMIN 전용
});

function resolveContractorId(
  session: { role: string; contractorId: string | null },
  bodyContractorId?: string,
): bigint | null {
  if (session.role === 'SUPER_ADMIN' && bodyContractorId) return BigInt(bodyContractorId);
  if (session.contractorId) return BigInt(session.contractorId);
  return null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const allowed = ['SUPER_ADMIN', 'INTERNAL_ADMIN', 'CONTRACTOR_ADMIN', 'MUNI_ADMIN'];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const onlyActive = url.searchParams.get('active') === 'true';
  const queryContractorId = url.searchParams.get('contractorId');

  let contractorFilter: { contractorId?: bigint; contractor?: { municipalityId: bigint } } = {};
  if (session.role === 'SUPER_ADMIN') {
    if (queryContractorId) contractorFilter = { contractorId: BigInt(queryContractorId) };
    // SUPER_ADMIN + no filter = 전체 조회
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    contractorFilter = { contractor: { municipalityId: BigInt(session.municipalityId) } };
  } else if (session.contractorId) {
    contractorFilter = { contractorId: BigInt(session.contractorId) };
  } else {
    return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
  }

  const items = await prisma.wasteTreatmentFacility.findMany({
    where: {
      ...contractorFilter,
      ...(onlyActive ? { active: true } : {}),
    },
    include: { contractor: { select: { id: true, companyName: true } } },
    orderBy: [{ active: 'desc' }, { type: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    items: items.map((f) => ({
      id: f.id.toString(),
      contractorId: f.contractorId.toString(),
      contractorName: f.contractor.companyName,
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

  const allowed = ['SUPER_ADMIN', 'INTERNAL_ADMIN', 'CONTRACTOR_ADMIN'];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;
  const contractorId = resolveContractorId(session, b.contractorId);
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  // Design Ref: §6.1 — duplicate_facility (UNIQUE [contractorId, type, name])
  const existing = await prisma.wasteTreatmentFacility.findFirst({
    where: { contractorId, type: b.type, name: b.name },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'duplicate_facility' }, { status: 400 });

  const created = await prisma.wasteTreatmentFacility.create({
    data: {
      contractorId,
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
      metadata: { type: b.type, name: b.name } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() });
}
