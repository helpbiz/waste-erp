/**
 * POST /api/complaints/[id]/start
 * - 처리 시작 (RECEIVED/ASSIGNED → IN_PROGRESS)
 * - 권한: 매니저 또는 본인 담당 건 (WORKER)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
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

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session, workerIsManager) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target, workerIsManager)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.status !== 'RECEIVED' && target.status !== 'ASSIGNED') {
    return NextResponse.json(
      { error: 'invalid_transition', from: target.status, to: 'IN_PROGRESS' },
      { status: 409 }
    );
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_START',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
