/**
 * GET  /api/super-admin/facility-ops — 일일 운전기록 목록
 *   query: ?facilityId=N&from=YYYY-MM-DD&to=YYYY-MM-DD (최대 90일)
 * POST /api/super-admin/facility-ops — upsert (같은 facility+date는 UPDATE)
 *
 * Design Ref: §3.1/3.2 — AVAC 운전기록 CRUD. Streamlit 07 이식.
 * Plan SC: FR-02 (upsert), FR-03 (기간 조회), FR-04 (권한 분기)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { getFacilityOperatorScope } from '@/lib/features';

export const runtime = 'nodejs';

const MAX_DAYS = 90;

const UpsertBody = z.object({
  facilityId: z.string(),
  opsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generalOpHours: z.number().min(0).max(24).default(0),
  foodOpHours: z.number().min(0).max(24).default(0),
  downtimeHours: z.number().min(0).max(24).default(0),
  downtimeReason: z.string().max(200).optional(),
  generalWasteTon: z.number().min(0).default(0),
  foodWasteTon: z.number().min(0).default(0),
  generalCollectTon: z.number().min(0).default(0),
  foodCollectTon: z.number().min(0).default(0),
  generalTransferTon: z.number().min(0).default(0),
  foodTransferTon: z.number().min(0).default(0),
  prevDayPowerKwh: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

// Design Ref: §5 — CONTRACTOR_ADMIN 시설 접근 제어 (municipality 단위)
async function resolveMunicipalityId(session: {
  role: string;
  contractorId: string | null;
  municipalityId: string | null;
}): Promise<bigint | null | 'all'> {
  if (session.role === 'SUPER_ADMIN') return 'all';
  if (session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true },
    });
    return c?.municipalityId ?? null;
  }
  return null;
}

function toOpsRow(r: {
  id: bigint;
  facilityId: bigint;
  facility: { name: string };
  opsDate: Date;
  generalOpHours: unknown;
  foodOpHours: unknown;
  downtimeHours: unknown;
  downtimeReason: string | null;
  generalWasteTon: unknown;
  foodWasteTon: unknown;
  generalCollectTon: unknown;
  foodCollectTon: unknown;
  generalTransferTon: unknown;
  foodTransferTon: unknown;
  prevDayPowerKwh: unknown;
  notes: string | null;
  updatedAt: Date;
}) {
  return {
    id: String(r.id),
    facilityId: String(r.facilityId),
    facilityName: r.facility.name,
    opsDate: r.opsDate.toISOString().slice(0, 10),
    generalOpHours: String(r.generalOpHours),
    foodOpHours: String(r.foodOpHours),
    downtimeHours: String(r.downtimeHours),
    downtimeReason: r.downtimeReason,
    generalWasteTon: String(r.generalWasteTon),
    foodWasteTon: String(r.foodWasteTon),
    generalCollectTon: String(r.generalCollectTon),
    foodCollectTon: String(r.foodCollectTon),
    generalTransferTon: String(r.generalTransferTon),
    foodTransferTon: String(r.foodTransferTon),
    prevDayPowerKwh: String(r.prevDayPowerKwh),
    notes: r.notes,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isAdmin = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role);
  let operatorFacilityId: bigint | null = null;

  if (!isAdmin) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (!opScope.isFacilityOperator || !opScope.primaryFacilityId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    operatorFacilityId = opScope.primaryFacilityId;
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const facilityIdParam = url.searchParams.get('facilityId');

  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
  if (diffDays > MAX_DAYS) {
    return NextResponse.json({ error: `기간은 최대 ${MAX_DAYS}일까지 조회 가능합니다` }, { status: 400 });
  }

  // 시설 담당자: 본인 담당 집하장만 조회 가능
  const effectiveFacilityId = operatorFacilityId
    ? operatorFacilityId
    : (facilityIdParam ? BigInt(facilityIdParam) : null);

  let muniFilter: { municipalityId: bigint } | undefined;
  if (isAdmin) {
    const muniId = await resolveMunicipalityId(session);
    if (muniId === null) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (muniId !== 'all') muniFilter = { municipalityId: muniId };
  }

  const items = await prisma.facilityDailyOps.findMany({
    where: {
      ...(effectiveFacilityId ? { facilityId: effectiveFacilityId } : {}),
      ...(muniFilter ? { facility: muniFilter } : {}),
      opsDate: { gte: fromDate, lte: toDate },
    },
    include: { facility: { select: { name: true } } },
    orderBy: [{ opsDate: 'asc' }, { facilityId: 'asc' }],
  });

  return NextResponse.json({ items: items.map(toOpsRow), total: items.length });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isAdmin = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role);
  let operatorFacilityId: bigint | null = null;

  if (!isAdmin) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (!opScope.isFacilityOperator || !opScope.primaryFacilityId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    operatorFacilityId = opScope.primaryFacilityId;
  }

  const body = await req.json().catch(() => null);
  const parsed = UpsertBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = parsed.data;
  const facilityIdBig = BigInt(data.facilityId);

  // 시설 담당자: 본인 담당 집하장만 기록 가능
  if (operatorFacilityId && operatorFacilityId !== facilityIdBig) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // CONTRACTOR_ADMIN: municipality 범위 검증
  if (session.role === 'CONTRACTOR_ADMIN') {
    const muniId = await resolveMunicipalityId(session);
    if (muniId === null) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const facility = await prisma.wasteTreatmentFacility.findUnique({
      where: { id: facilityIdBig },
      select: { municipalityId: true },
    });
    if (!facility || facility.municipalityId !== muniId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const opsDateVal = new Date(data.opsDate);
  const createData = {
    facilityId: facilityIdBig,
    opsDate: opsDateVal,
    generalOpHours: data.generalOpHours,
    foodOpHours: data.foodOpHours,
    downtimeHours: data.downtimeHours,
    downtimeReason: data.downtimeReason ?? null,
    generalWasteTon: data.generalWasteTon,
    foodWasteTon: data.foodWasteTon,
    generalCollectTon: data.generalCollectTon,
    foodCollectTon: data.foodCollectTon,
    generalTransferTon: data.generalTransferTon,
    foodTransferTon: data.foodTransferTon,
    prevDayPowerKwh: data.prevDayPowerKwh,
    notes: data.notes ?? null,
    createdBy: session.userId ? BigInt(session.userId) : null,
  };

  const record = await prisma.facilityDailyOps.upsert({
    where: { facilityId_opsDate: { facilityId: facilityIdBig, opsDate: opsDateVal } },
    update: {
      generalOpHours: data.generalOpHours,
      foodOpHours: data.foodOpHours,
      downtimeHours: data.downtimeHours,
      downtimeReason: data.downtimeReason ?? null,
      generalWasteTon: data.generalWasteTon,
      foodWasteTon: data.foodWasteTon,
      generalCollectTon: data.generalCollectTon,
      foodCollectTon: data.foodCollectTon,
      generalTransferTon: data.generalTransferTon,
      foodTransferTon: data.foodTransferTon,
      prevDayPowerKwh: data.prevDayPowerKwh,
      notes: data.notes ?? null,
    },
    create: createData,
    include: { facility: { select: { name: true } } },
  });

  // Plan SC: FR-04 감사 로그
  await writeAudit(req, session, {
    action: 'facility_ops_upsert',
    resourceType: 'facility_daily_ops',
    resourceId: String(record.id),
    metadata: { facilityId: data.facilityId, opsDate: data.opsDate },
  });

  return NextResponse.json({ item: toOpsRow(record) });
}
