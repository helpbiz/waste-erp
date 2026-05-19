/**
 * POST /api/complaints/[id]/arrive
 * - 워커 도착 시점 기록 (arrivedAt = now)
 * - 본인 담당 건 (WORKER) 또는 매니저
 * - 멱등: 이미 arrivedAt 있으면 그대로 유지
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint, isComplaintManager } from '@/lib/complaints';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session, workerIsManager) },
    select: { id: true, status: true, assignedTo: true, arrivedAt: true, departedAt: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target, workerIsManager)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.arrivedAt) {
    return NextResponse.json({ ok: true, arrivedAt: target.arrivedAt.toISOString(), idempotent: true });
  }
  if (target.status === 'COMPLETED' || target.status === 'REJECTED') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
  }

  const now = new Date();
  /* departedAt 없으면 보정 (워커가 깜빡 → 도착 시점에 둘 다 기록) */
  const data: { arrivedAt: Date; departedAt?: Date; status?: 'IN_PROGRESS' } = { arrivedAt: now };
  if (!target.departedAt) data.departedAt = now;
  if (target.status === 'RECEIVED' || target.status === 'ASSIGNED') data.status = 'IN_PROGRESS';

  const updated = await prisma.complaint.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_ARRIVE',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, arrivedAt: now.toISOString(), status: updated.status });
}
