/**
 * POST /api/complaints/[id]/assign
 * - 담당자 지정 + 처리 기한 설정 (Plan §3-3 관리자 처리)
 * - 권한: SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, isComplaintManager } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  assignedTo: z.union([z.string(), z.number()]),
  dueDate: z.string().datetime().optional(), // ISO
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  if (!isComplaintManager(session.role) && !workerIsManager) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  /* 가시범위 + 동일 위탁업체 검증 */
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session, workerIsManager) },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const assigneeId = BigInt(parsed.data.assignedTo);
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || assignee.role !== 'WORKER' || assignee.contractorId !== target.contractorId) {
    return NextResponse.json({ error: 'invalid_assignee' }, { status: 400 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      assignedTo: assigneeId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : target.dueDate,
      status: target.status === 'RECEIVED' ? 'ASSIGNED' : target.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_ASSIGN',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { assignedTo: assigneeId.toString(), dueDate: parsed.data.dueDate ?? null } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    complaint: {
      id: updated.id.toString(),
      status: updated.status,
      assignedTo: updated.assignedTo?.toString() ?? null,
      dueDate: updated.dueDate?.toISOString() ?? null,
    },
  });
}
