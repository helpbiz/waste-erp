/**
 * PATCH  /api/vehicles/[id]  — 차량 정보 수정 (매니저)
 *  - 차량번호 변경은 중복 검사
 *  - status 변경(ACTIVE↔MAINTENANCE)도 여기서 처리
 *  - RETIRED로의 변경은 별도 endpoint (/retire)
 * DELETE /api/vehicles/[id]  — 차량 삭제 (매니저, 진행 중 운행일지 없을 때만)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleWhere, isVehicleLogManager } from '@/lib/vehicle-logs';
import { VEHICLE_TYPE_VALUES } from '@/lib/vehicle-types';

export const runtime = 'nodejs';

const PLATE_REGEX = /^\d{2,3}[가-힣]\d{4}$/;

const PatchBody = z.object({
  vehicleNo: z.string().trim().regex(PLATE_REGEX).optional(),
  vehicleType: z.enum(VEHICLE_TYPE_VALUES).optional(),
  vehicleTon: z.string().trim().max(8).nullable().optional(),
  capacityTon: z.number().min(0).max(99).nullable().optional(),
  fuelType: z.enum(['DIESEL', 'LPG', 'ELECTRIC', 'CNG', 'GASOLINE']).optional(),
  yearManufactured: z.number().int().min(1990).max(2099).nullable().optional(),
  registrationDate: z.string().nullable().optional(), // 'YYYY-MM-DD'
  status: z.enum(['ACTIVE', 'MAINTENANCE']).optional(), // RETIRED는 /retire endpoint 전용
  driverId: z.union([z.string(), z.number()]).nullable().optional(),
  passenger1Id: z.union([z.string(), z.number()]).nullable().optional(),
  passenger2Id: z.union([z.string(), z.number()]).nullable().optional(),
  operationStartDate: z.string().nullable().optional(),
  initialMileage: z.number().int().min(0).max(9_999_999).nullable().optional(),
  /* totalMileage는 직접 수정 불가 — 운행일지 승인 시 자동 누적 */
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.vehicle.findFirst({ where: { id, ...vehicleWhere(session) } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  /* 차량번호 변경 시 중복 검사 */
  if (b.vehicleNo && b.vehicleNo !== target.vehicleNo) {
    const dup = await prisma.vehicle.findUnique({
      where: { contractorId_vehicleNo: { contractorId: target.contractorId, vehicleNo: b.vehicleNo } },
    });
    if (dup) return NextResponse.json({ error: 'duplicate_vehicle_no' }, { status: 409 });
  }

  /* driver/passenger 검증 (본인 위탁업체 WORKER만 / null 허용) + 중복 방지 */
  const targetContractorId = target.contractorId;
  async function validateWorker(id: string | number | null | undefined): Promise<void> {
    if (id == null) return;
    const u = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!u || u.role !== 'WORKER' || u.contractorId !== targetContractorId) {
      throw new Error('invalid_worker');
    }
  }
  try {
    await validateWorker(b.driverId);
    await validateWorker(b.passenger1Id);
    await validateWorker(b.passenger2Id);
  } catch {
    return NextResponse.json({ error: 'invalid_driver_or_passenger' }, { status: 400 });
  }
  /* 중복 방지 — 변경 후 최종 driver/p1/p2가 다른 인물인지 */
  const finalDriver = b.driverId !== undefined ? (b.driverId === null ? null : BigInt(b.driverId)) : target.driverId;
  const finalP1 = b.passenger1Id !== undefined ? (b.passenger1Id === null ? null : BigInt(b.passenger1Id)) : target.passenger1Id;
  const finalP2 = b.passenger2Id !== undefined ? (b.passenger2Id === null ? null : BigInt(b.passenger2Id)) : target.passenger2Id;
  const ids = [finalDriver, finalP1, finalP2].filter(Boolean) as bigint[];
  if (new Set(ids.map((i) => i.toString())).size !== ids.length) {
    return NextResponse.json({ error: 'duplicate_crew_member', message: '운전자/동승자 1/2 는 모두 다른 사람이어야 합니다.' }, { status: 400 });
  }

  /* initialMileage 변경 시 totalMileage 자동 재계산 */
  let newTotal: number | undefined = undefined;
  if (b.initialMileage !== undefined && b.initialMileage !== target.initialMileage) {
    const approvedDelta = await prisma.vehicleLog.aggregate({
      where: { vehicleId: id, status: 'APPROVED' },
      _sum: {
        startMileage: true,
        endMileage: true,
      },
    });
    const sumStart = approvedDelta._sum.startMileage ?? 0;
    const sumEnd = approvedDelta._sum.endMileage ?? 0;
    newTotal = (b.initialMileage ?? 0) + (sumEnd - sumStart);
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(b.vehicleNo !== undefined && { vehicleNo: b.vehicleNo }),
      ...(b.vehicleType !== undefined && { vehicleType: b.vehicleType }),
      ...(b.vehicleTon !== undefined && { vehicleTon: b.vehicleTon }),
      ...(b.capacityTon !== undefined && { capacityTon: b.capacityTon }),
      ...(b.fuelType !== undefined && { fuelType: b.fuelType }),
      ...(b.yearManufactured !== undefined && { yearManufactured: b.yearManufactured }),
      ...(b.status !== undefined && { status: b.status }),
      ...(b.driverId !== undefined && { driverId: b.driverId === null ? null : BigInt(b.driverId) }),
      ...(b.passenger1Id !== undefined && { passenger1Id: b.passenger1Id === null ? null : BigInt(b.passenger1Id) }),
      ...(b.passenger2Id !== undefined && { passenger2Id: b.passenger2Id === null ? null : BigInt(b.passenger2Id) }),
      ...(b.registrationDate !== undefined && {
        registrationDate: b.registrationDate ? new Date(b.registrationDate) : null,
      }),
      ...(b.operationStartDate !== undefined && {
        operationStartDate: b.operationStartDate ? new Date(b.operationStartDate) : null,
      }),
      ...(b.initialMileage !== undefined && { initialMileage: b.initialMileage }),
      ...(newTotal !== undefined && { totalMileage: newTotal }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_UPDATE',
      resourceType: 'vehicle',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { changedKeys: Object.keys(b) } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    vehicle: {
      id: updated.id.toString(),
      vehicleNo: updated.vehicleNo,
      vehicleType: updated.vehicleType,
      status: updated.status,
    },
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.vehicle.findFirst({ where: { id, ...vehicleWhere(session) } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* 진행 중(DRAFT/SUBMITTED) 운행일지가 있으면 삭제 불가 */
  const activeLog = await prisma.vehicleLog.findFirst({
    where: { vehicleId: id, status: { in: ['DRAFT', 'SUBMITTED'] } },
    select: { id: true },
  });
  if (activeLog) {
    return NextResponse.json(
      { error: 'has_active_logs', message: '진행 중인 운행일지가 있어 삭제할 수 없습니다. 먼저 운행일지를 처리하세요.' },
      { status: 409 }
    );
  }

  await prisma.vehicle.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_DELETE',
      resourceType: 'vehicle',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleNo: target.vehicleNo } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
