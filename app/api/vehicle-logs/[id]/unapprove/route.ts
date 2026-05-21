/**
 * POST /api/vehicle-logs/[id]/unapprove — APPROVED → SUBMITTED (승인 취소)
 * - 차량 누적주행거리 역산 복원
 * - 권한: CONTRACTOR_ADMIN / INTERNAL_ADMIN / SUPER_ADMIN
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager, vehicleLogWhere } from '@/lib/vehicle-logs';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const log = await prisma.vehicleLog.findFirst({ where: { id, ...vehicleLogWhere(session) } });
  if (!log) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (log.status !== 'APPROVED') {
    return NextResponse.json({ error: 'invalid_transition', from: log.status, to: 'SUBMITTED' }, { status: 409 });
  }

  /* 승인 시 누적된 주행거리를 역산 복원 */
  const delta =
    log.startMileage != null && log.endMileage != null
      ? Math.max(0, log.endMileage - log.startMileage)
      : 0;

  const [updated] = await prisma.$transaction([
    prisma.vehicleLog.update({ where: { id }, data: { status: 'SUBMITTED' } }),
    prisma.vehicle.update({
      where: { id: log.vehicleId },
      data: delta > 0 ? { totalMileage: { decrement: delta } } : {},
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_UNAPPROVE',
      resourceType: 'vehicle_log',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { mileageDeltaReversed: delta } as object,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
