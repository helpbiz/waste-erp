/**
 * POST /api/complaints/[id]/depart
 * - 워커 출동 시점 기록 (departedAt = now)
 * - NavButtons 클릭 시 sendBeacon 으로 비동기 호출
 * - 권한: 본인 담당 건 (WORKER) 또는 매니저
 * - 멱등 (idempotent): 이미 departedAt 있으면 그대로 유지 (재호출 무시)
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
    select: { id: true, status: true, assignedTo: true, departedAt: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target, workerIsManager)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.departedAt) {
    /* 이미 출동 기록 있음 → 멱등 처리 (sendBeacon 중복 호출 안전) */
    return NextResponse.json({ ok: true, departedAt: target.departedAt.toISOString(), idempotent: true });
  }
  if (target.status === 'COMPLETED' || target.status === 'REJECTED') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
  }

  const now = new Date();
  /* RECEIVED/ASSIGNED 상태면 IN_PROGRESS 로 자동 전이 (업무 흐름 자연화) */
  const nextStatus = (target.status === 'RECEIVED' || target.status === 'ASSIGNED') ? 'IN_PROGRESS' : target.status;
  const updated = await prisma.complaint.update({
    where: { id },
    data: { departedAt: now, status: nextStatus },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_DEPART',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, departedAt: now.toISOString(), status: updated.status });
}
