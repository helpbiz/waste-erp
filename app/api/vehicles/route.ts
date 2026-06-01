/**
 * GET  /api/vehicles  — 가시범위 내 차량 목록
 * POST /api/vehicles  — 차량 등록 (매니저)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleWhere, isVehicleLogManager } from '@/lib/vehicle-logs';
import { VEHICLE_TYPE_VALUES } from '@/lib/vehicle-types';

export const runtime = 'nodejs';

/* 한국식 번호판: '11가1234' (2~3자리 숫자 + 한글 1자 + 4자리 숫자) */
const PLATE_REGEX = /^\d{2,3}[가-힣]\d{4}$/;

const PostBody = z.object({
  vehicleNo: z.string().trim().regex(PLATE_REGEX, '차량번호 형식: 11가1234'),
  vehicleType: z.enum(VEHICLE_TYPE_VALUES),
  vehicleTon: z.string().trim().max(8).optional(),
  capacityTon: z.number().min(0).max(99).optional(),
  fuelType: z.enum(['DIESEL', 'LPG', 'ELECTRIC', 'CNG', 'GASOLINE']),
  yearManufactured: z.number().int().min(1990).max(2099).optional(),
  driverId: z.union([z.string(), z.number()]).nullable().optional(),
  passenger1Id: z.union([z.string(), z.number()]).nullable().optional(),
  passenger2Id: z.union([z.string(), z.number()]).nullable().optional(),
  operationStartDate: z.string().nullable().optional(), // 'YYYY-MM-DD' or ISO
  initialMileage: z.number().int().min(0).max(9_999_999).optional(),
  contractorId: z.union([z.string(), z.number()]).optional(), // SUPER만
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const where = vehicleWhere(session);
  if (status && ['ACTIVE', 'MAINTENANCE', 'RETIRED'].includes(status)) {
    (where as Record<string, unknown>).status = status;
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { vehicleNo: 'asc' },
  });

  return NextResponse.json({
    vehicles: vehicles.map((v) => ({
      id: v.id.toString(),
      contractorId: v.contractorId.toString(),
      vehicleNo: v.vehicleNo,
      vehicleType: v.vehicleType,
      vehicleTon: v.vehicleTon,
      capacityTon: v.capacityTon ? Number(v.capacityTon) : null,
      fuelType: v.fuelType,
      yearManufactured: v.yearManufactured,
      status: v.status,
      driverId: v.driverId?.toString() ?? null,
      passenger1Id: v.passenger1Id?.toString() ?? null,
      passenger2Id: v.passenger2Id?.toString() ?? null,
      operationStartDate: v.operationStartDate?.toISOString().slice(0, 10) ?? null,
      initialMileage: v.initialMileage,
      totalMileage: v.totalMileage,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  /* contractorId 결정 */
  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN') {
    if (!b.contractorId) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    contractorId = BigInt(b.contractorId);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  /* 중복 체크 */
  const exists = await prisma.vehicle.findUnique({
    where: { contractorId_vehicleNo: { contractorId, vehicleNo: b.vehicleNo } },
  });
  if (exists) return NextResponse.json({ error: 'duplicate_vehicle_no' }, { status: 409 });

  /* driver/passenger 검증 — 본인 위탁업체 소속 WORKER만 + 중복 방지 */
  async function validateWorker(id: string | number | null | undefined): Promise<bigint | null> {
    if (id == null) return null;
    const u = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!u || u.role !== 'WORKER' || u.contractorId !== contractorId) {
      throw new Error('invalid_worker');
    }
    return u.id;
  }
  let driverId: bigint | null = null;
  let passenger1Id: bigint | null = null;
  let passenger2Id: bigint | null = null;
  try {
    driverId = await validateWorker(b.driverId);
    passenger1Id = await validateWorker(b.passenger1Id);
    passenger2Id = await validateWorker(b.passenger2Id);
  } catch {
    return NextResponse.json({ error: 'invalid_driver_or_passenger' }, { status: 400 });
  }
  const ids = [driverId, passenger1Id, passenger2Id].filter(Boolean);
  if (new Set(ids.map((i) => i!.toString())).size !== ids.length) {
    return NextResponse.json({ error: 'duplicate_crew_member', message: '운전자/동승자 1/2 는 모두 다른 사람이어야 합니다.' }, { status: 400 });
  }

  const data: Prisma.VehicleCreateInput = {
    contractor: { connect: { id: contractorId } },
    vehicleNo: b.vehicleNo,
    vehicleType: b.vehicleType,
    vehicleTon: b.vehicleTon ?? null,
    capacityTon: b.capacityTon ?? null,
    fuelType: b.fuelType,
    yearManufactured: b.yearManufactured ?? null,
    status: 'ACTIVE',
    operationStartDate: b.operationStartDate ? new Date(b.operationStartDate) : null,
    initialMileage: b.initialMileage ?? null,
    totalMileage: b.initialMileage ?? null,
    ...(driverId ? { driver: { connect: { id: driverId } } } : {}),
    ...(passenger1Id ? { passenger1: { connect: { id: passenger1Id } } } : {}),
    ...(passenger2Id ? { passenger2: { connect: { id: passenger2Id } } } : {}),
  };

  const created = await prisma.vehicle.create({ data });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_CREATE',
      resourceType: 'vehicle',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleNo: b.vehicleNo, vehicleType: b.vehicleType } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    vehicle: {
      id: created.id.toString(),
      vehicleNo: created.vehicleNo,
      vehicleType: created.vehicleType,
      status: created.status,
    },
  });
}
