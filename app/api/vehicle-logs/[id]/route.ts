/**
 * DELETE /api/vehicle-logs/[id] — 운행일지 삭제
 *
 * 매니저: 가시범위 내 모든 상태 삭제 가능
 * 작업자: 본인 작성 DRAFT·REJECTED 상태만 삭제 가능 (삭제 후 재작성 허용)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager } from '@/lib/vehicle-logs';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isManager = isVehicleLogManager(session.role);
  const isWorker  = session.role === 'WORKER';
  if (!isManager && !isWorker) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const log = await prisma.vehicleLog.findUnique({
    where: { id },
    include: { vehicle: { select: { contractorId: true, vehicleNo: true } } },
  });
  if (!log) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (isManager) {
    /* 매니저: 본인 업체 차량만 (SUPER_ADMIN 제외) */
    if (session.role !== 'SUPER_ADMIN') {
      if (!session.contractorId || log.vehicle.contractorId.toString() !== session.contractorId) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }
  } else {
    /* 작업자: 본인 작성 + DRAFT or REJECTED 만 */
    if (log.driverId.toString() !== session.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!['DRAFT', 'REJECTED'].includes(log.status)) {
      return NextResponse.json({
        error: 'not_deletable',
        message: '제출 완료·승인된 일지는 삭제할 수 없습니다. 관리자에게 문의하세요.',
      }, { status: 409 });
    }
  }

  await prisma.vehicleLog.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_DELETE',
      resourceType: 'vehicle_log',
      resourceId: id.toString(),
      ipAddress: _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleNo: log.vehicle.vehicleNo, status: log.status } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
