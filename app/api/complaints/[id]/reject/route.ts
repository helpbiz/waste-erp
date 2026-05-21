/**
 * POST /api/complaints/[id]/reject
 * - 반려 (→ REJECTED) + 사유 필수
 * - 권한: 매니저 또는 본인 담당 WORKER (canTransitionComplaint)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint, isComplaintManager } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  reason: z.string().trim().min(2).max(2000).optional(),
  note: z.string().trim().max(2000).optional(),  /* 워커 앱 호환 */
}).transform((d) => ({ reason: (d.reason || d.note || '').trim() }))
  .refine((d) => d.reason.length >= 2, { message: '반려 사유는 2자 이상 필요합니다.' });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

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
  if (target.status === 'REJECTED' || target.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'invalid_transition', from: target.status, to: 'REJECTED' },
      { status: 409 }
    );
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'REJECTED', resolveNote: parsed.data.reason, resolvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_REJECT',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { reasonLen: parsed.data.reason.length } as object,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
