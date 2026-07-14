/**
 * GET  /api/recycling-intake?from&to&vehicleId&category
 * POST /api/recycling-intake — 신규 등록
 *   body: { intakeDate, intakeTime, vehicleId, facilityId?, materialCategory, weightTon, note? }
 *
 * Design Ref: §3.1.2 — facilityId NULL 허용 (backward-compat)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  intakeDate: z.string(),
  intakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  vehicleId: z.string(),
  facilityId: z.string().nullable().optional(),
  disposalSiteId: z.string().nullable().optional(),
  materialCategory: z.string().trim().min(1).max(20),
  weightTon: z.number().min(0).max(99_999),
  note: z.string().max(500).optional(),
});

function contractorScope(session: { role: string; contractorId: string | null; municipalityId: string | null }) {
  if (session.role === 'SUPER_ADMIN') return {} as Prisma.RecyclingCenterIntakeWhereInput;
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const where: Prisma.RecyclingCenterIntakeWhereInput = { ...contractorScope(session) };
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const vehicleId = url.searchParams.get('vehicleId');
  const category = url.searchParams.get('category');
  if (from && to) where.intakeDate = { gte: new Date(from), lte: new Date(to) };
  if (vehicleId) {
    const vid = parseId(vehicleId);
    if (vid == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    where.vehicleId = vid;
  }
  if (category) where.materialCategory = category;

  const items = await prisma.recyclingCenterIntake.findMany({
    where,
    include: {
      vehicle: { select: { id: true, vehicleNo: true, vehicleType: true } },
      facility: { select: { id: true, type: true, name: true } },
      disposalSite: { select: { id: true, name: true } },
      recorder: { select: { id: true, name: true } },
    },
    orderBy: [{ intakeDate: 'desc' }, { intakeTime: 'desc' }],
    take: 1000,
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id.toString(),
      intakeDate: i.intakeDate.toISOString().slice(0, 10),
      intakeTime: i.intakeTime,
      vehicleId: i.vehicleId.toString(),
      vehicleNo: i.vehicle.vehicleNo,
      vehicleType: i.vehicle.vehicleType,
      facilityId: i.facilityId?.toString() ?? null,
      facilityName: i.facility?.name ?? null,
      facilityType: i.facility?.type ?? null,
      disposalSiteId: i.disposalSiteId?.toString() ?? null,
      disposalSiteName: i.disposalSite?.name ?? null,
      materialCategory: i.materialCategory,
      weightTon: Number(i.weightTon.toString()),
      note: i.note,
      recorderName: i.recorder.name,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const contractorId = BigInt(session.contractorId);

  /* 성상 가시범위 검증 — 관리자가 등록한 활성 성상만 허용 */
  const category = await prisma.intakeMaterialCategory.findFirst({
    where: { contractorId, label: b.materialCategory, isActive: true },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: 'invalid_material_category' }, { status: 400 });

  /* 차량 가시범위 검증 */
  const bVehicleId = parseId(b.vehicleId);
  if (!bVehicleId) return NextResponse.json({ error: 'invalid_vehicleId' }, { status: 400 });
  const v = await prisma.vehicle.findFirst({
    where: { id: bVehicleId, contractorId },
    select: { id: true },
  });
  if (!v) return NextResponse.json({ error: 'invalid_vehicle' }, { status: 400 });

  /* Design Ref: §3.1.2 — facilityId 가시범위 검증
     (지자체 단위로 변경됨 — 본인 contractor의 muni 산하 facility 만 허용) */
  let facilityIdBig: bigint | null = null;
  if (b.facilityId) {
    const myMuniId = (await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { municipalityId: true },
    }))?.municipalityId;
    const f = myMuniId
      ? await prisma.wasteTreatmentFacility.findFirst({
          where: { id: parseId(b.facilityId) ?? BigInt(-1), municipalityId: myMuniId, active: true },
          select: { id: true },
        })
      : null;
    if (!f) return NextResponse.json({ error: 'invalid_facility' }, { status: 400 });
    facilityIdBig = f.id;
  }

  /* disposalSiteId 가시범위 검증 */
  let disposalSiteIdBig: bigint | null = null;
  if (b.disposalSiteId) {
    const site = await prisma.disposalSite.findFirst({
      where: { id: parseId(b.disposalSiteId) ?? BigInt(-1), contractorId, isActive: true },
      select: { id: true },
    });
    if (!site) return NextResponse.json({ error: 'invalid_disposal_site' }, { status: 400 });
    disposalSiteIdBig = site.id;
  }

  const created = await prisma.recyclingCenterIntake.create({
    data: {
      contractorId,
      intakeDate: new Date(b.intakeDate),
      intakeTime: b.intakeTime,
      vehicleId: v.id,
      facilityId: facilityIdBig,
      disposalSiteId: disposalSiteIdBig,
      materialCategory: b.materialCategory,
      weightTon: b.weightTon,
      note: b.note ?? null,
      recordedBy: BigInt(session.userId),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'INTAKE_CREATE',
      resourceType: 'recycling_center_intake',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        date: b.intakeDate, time: b.intakeTime,
        vehicleId: b.vehicleId, category: b.materialCategory,
        weight: b.weightTon,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() });
}
