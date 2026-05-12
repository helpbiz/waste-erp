/**
 * POST /api/vehicle-logs/[id]/submit — DRAFT → SUBMITTED (작성자 본인)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const log = await prisma.vehicleLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!log.driverId || log.driverId.toString() !== session.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (log.status !== 'DRAFT') {
    return NextResponse.json({ error: 'invalid_transition', from: log.status, to: 'SUBMITTED' }, { status: 409 });
  }

  /* 필수 필드 보장 — endMileage(금일누적거리)만 필수, startMileage는 선택 */
  if (log.endMileage == null) {
    return NextResponse.json({ error: 'mileage_required', field: 'endMileage' }, { status: 422 });
  }

  const updated = await prisma.vehicleLog.update({
    where: { id },
    data: { status: 'SUBMITTED' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_SUBMIT',
      resourceType: 'vehicle_log',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
