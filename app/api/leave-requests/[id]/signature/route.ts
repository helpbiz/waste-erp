/**
 * GET /api/leave-requests/[id]/signature — 결재 인증서
 * Design Ref: §4 (FR-13)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const lr = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      worker: { select: { id: true, name: true, employeeNo: true, contractorId: true } },
      approvalEvent: {
        include: {
          actor: { select: { id: true, name: true, role: true } },
          delegatedFrom: { select: { id: true, name: true, role: true } },
          signature: { include: { asset: true } },
        },
      },
      firstApprovalEvent: {
        include: {
          actor: { select: { id: true, name: true, role: true } },
          delegatedFrom: { select: { id: true, name: true, role: true } },
          signature: { include: { asset: true } },
        },
      },
      finalApprovalEvent: {
        include: {
          actor: { select: { id: true, name: true, role: true, position: { select: { code: true, label: true } } } },
          delegatedFrom: { select: { id: true, name: true, role: true } },
          signature: { include: { asset: true } },
        },
      },
    },
  });
  if (!lr) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* 가시범위 검증 */
  const isWorker = session.role === 'WORKER' && lr.workerId.toString() === session.userId;
  if (!isWorker) {
    if (!canManageUsers(session.role) && session.role !== 'MUNI_ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const inScope = await prisma.user.findFirst({
      where: { id: lr.workerId, ...userScope(session) },
      select: { id: true },
    });
    if (!inScope) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!lr.approvalEvent && !lr.firstApprovalEvent) {
    return NextResponse.json({ error: 'no_approval_event' }, { status: 404 });
  }

  function serialize(ev: NonNullable<typeof lr>['approvalEvent']) {
    if (!ev) return null;
    return {
      action: ev.action,
      actorName: ev.actor.name,
      actorRole: ev.actor.role,
      delegatedFromName: ev.delegatedFrom?.name ?? null,
      delegatedFromRole: ev.delegatedFrom?.role ?? null,
      signedAt: ev.createdAt.toISOString(),
      signatureRef: ev.signatureRef,
      signatureUrl: ev.signature?.asset.contentRef ?? null,
      ipAddress: ev.ipAddress,
      comment: ev.comment,
    };
  }

  return NextResponse.json({
    leaveRequest: {
      id: lr.id.toString(),
      requestType: lr.requestType,
      startDate: lr.startDate.toISOString().slice(0, 10),
      endDate: lr.endDate.toISOString().slice(0, 10),
      status: lr.status,
    },
    worker: {
      id: lr.worker.id.toString(),
      name: lr.worker.name,
      employeeNo: lr.worker.employeeNo,
    },
    /* 호환 — 구 단일 결재 응답 */
    approval: serialize(lr.approvalEvent),
    /* 신규 2단계 */
    firstApproval: serialize(lr.firstApprovalEvent),
    finalApproval: serialize(lr.finalApprovalEvent),
    finalApproverPosition: lr.finalApprovalEvent?.actor.position
      ? { code: lr.finalApprovalEvent.actor.position.code, label: lr.finalApprovalEvent.actor.position.label }
      : null,
  });
}
