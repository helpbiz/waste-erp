/**
 * GET  /api/vehicle-logs — 운행일지 목록 (가시범위 자동)
 * POST /api/vehicle-logs — 작성 (WORKER, status=DRAFT)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { todayKstDate } from '@/lib/dates';

export const runtime = 'nodejs';

const PostBody = z.object({
  vehicleId: z.union([z.string(), z.number()]),
  zoneId: z.union([z.string(), z.number()]).optional(),
  startMileage: z.number().int().min(0).max(9_999_999).optional(),
  endMileage: z.number().int().min(0).max(9_999_999).optional(),
  fuelUsed: z.number().min(0).max(10_000).optional(),
  wasteWeightKg: z.number().min(0).max(99_999).optional(),
  tripCount: z.number().int().min(0).max(99).optional(),
  routeDetail: z.string().trim().max(2000).optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  const where = vehicleLogWhere(session);
  if (status && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(status)) {
    (where as Record<string, unknown>).status = status;
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    (where as Record<string, unknown>).logDate = new Date(date + 'T00:00:00.000Z');
  }

  const items = await prisma.vehicleLog.findMany({
    where,
    orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
    take: limit,
    include: {
      vehicle: { select: { id: true, vehicleNo: true, vehicleType: true, vehicleTon: true, status: true } },
      driver: { select: { id: true, name: true } },
      zone: { select: { zoneName: true } },
    },
  });

  return NextResponse.json({
    role: session.role,
    items: items.map((l) => ({
      id: l.id.toString(),
      logDate: l.logDate.toISOString().slice(0, 10),
      status: l.status,
      vehicle: { id: l.vehicle.id.toString(), no: l.vehicle.vehicleNo, type: l.vehicle.vehicleType, ton: l.vehicle.vehicleTon, status: l.vehicle.status },
      driver: { id: l.driver.id.toString(), name: l.driver.name },
      zoneName: l.zone?.zoneName ?? null,
      startMileage: l.startMileage,
      endMileage: l.endMileage,
      mileageDelta: l.startMileage != null && l.endMileage != null ? l.endMileage - l.startMileage : null,
      fuelUsed: l.fuelUsed ? Number(l.fuelUsed) : null,
      wasteWeightKg: l.wasteWeightKg ? Number(l.wasteWeightKg) : null,
      tripCount: l.tripCount,
      routeDetail: l.routeDetail,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') {
    return NextResponse.json({ error: 'workers_only' }, { status: 403 });
  }
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  /* 차량이 본인 위탁업체 소속인지 확인 */
  const vehicle = await prisma.vehicle.findUnique({ where: { id: BigInt(b.vehicleId) } });
  if (!vehicle || vehicle.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'invalid_vehicle' }, { status: 400 });
  }
  if (vehicle.status === 'RETIRED') {
    return NextResponse.json({ error: 'vehicle_retired' }, { status: 409 });
  }

  if (b.startMileage != null && b.endMileage != null && b.endMileage < b.startMileage) {
    return NextResponse.json({ error: 'invalid_mileage', message: '종료 주행거리는 시작보다 커야 합니다.' }, { status: 422 });
  }

  const log = await prisma.vehicleLog.create({
    data: {
      vehicleId: vehicle.id,
      driverId: BigInt(session.userId),
      logDate: todayKstDate(),
      zoneId: b.zoneId !== undefined ? BigInt(b.zoneId) : null,
      startMileage: b.startMileage,
      endMileage: b.endMileage,
      fuelUsed: b.fuelUsed,
      wasteWeightKg: b.wasteWeightKg,
      tripCount: b.tripCount,
      routeDetail: b.routeDetail ?? null,
      status: 'DRAFT',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_CREATE',
      resourceType: 'vehicle_log',
      resourceId: log.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleNo: vehicle.vehicleNo } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    log: { id: log.id.toString(), status: log.status, logDate: log.logDate.toISOString().slice(0, 10) },
  });
}
