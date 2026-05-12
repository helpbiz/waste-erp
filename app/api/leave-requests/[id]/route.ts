/**
 * PATCH  /api/leave-requests/[id] — 승인/반려 (관리자) + 연차 사용일수 자동 차감
 *   { action: 'APPROVE' | 'REJECT' }
 * DELETE /api/leave-requests/[id] — 신청 취소 (PENDING 상태에서만, 본인 또는 관리자)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers, leaveDayCount } from '@/lib/users';
import { resolveApprovalSignature } from '@/lib/signatures';
import { recordApproval } from '@/lib/approvals';
import { resolveDelegationFor } from '@/lib/delegation';
import { getApprovalPolicy, canApproveStage, DEFAULT_POLICY } from '@/lib/approval-policy';
import { hasFeature } from '@/lib/features';

export const runtime = 'nodejs';

const Body = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  signature: z.string().max(280_000).optional(),
  useStoredSignature: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
});

/**
 * 휴가 사용일수 계산 (반차 = 0.5일 고정)
 */
function leaveDays(requestType: string, startDate: Date, endDate: Date): number {
  if (requestType === 'ANNUAL_HALF') return 0.5;
  return leaveDayCount(startDate, endDate);
}

/** 잔여에서 차감해야 하는 연차성 휴가 */
const ANNUAL_TYPES = new Set(['ANNUAL', 'ANNUAL_HALF']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const target = await prisma.leaveRequest.findFirst({
    where: { id, worker: userScope(session) },
    include: { worker: { select: { id: true, contractorId: true } } },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (target.status === 'APPROVED' || target.status === 'REJECTED') {
    return NextResponse.json({ error: 'already_decided', current: target.status }, { status: 409 });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const delegation = await resolveDelegationFor({ actorId: BigInt(session.userId), resourceType: 'leave_request' });

  /* 액터의 직책 + 정책 사전 조회 */
  const actor = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    include: { position: true },
  });
  const actorPositionCode = actor?.position?.code ?? null;
  const policyContractorId = target.worker.contractorId
    ?? (session.contractorId ? BigInt(session.contractorId) : null);
  const rawPolicy = policyContractorId
    ? await getApprovalPolicy(policyContractorId, 'leave_request')
    : { stage1: DEFAULT_POLICY.leave_request.stage1, stage2: DEFAULT_POLICY.leave_request.stage2 };
  /* leaveApprovalSingleStage: 활성화 시 stage1 권한자가 stage2도 겸함 (관리자 단독 최종 결재) */
  const singleStage = policyContractorId
    ? await hasFeature(policyContractorId, 'leaveApprovalSingleStage')
    : false;
  const policy = singleStage
    ? { stage1: rawPolicy.stage1, stage2: [...new Set([...rawPolicy.stage1, ...rawPolicy.stage2])] }
    : rawPolicy;
  /* 관리자 역할은 직책 미지정이어도 1·2차 결재 모두 허용 */
  const isAdminRole = ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN'].includes(session.role);
  const canStage1 = isAdminRole || canApproveStage(actorPositionCode, policy.stage1);
  const canStage2 = isAdminRole || canApproveStage(actorPositionCode, policy.stage2);
  /* 호환: 'CEO' 직접 검사 (구 코드와 동일 동작 유지) */
  const isCEO = actorPositionCode === 'CEO';

  /* ───── REJECT ───── */
  if (parsed.data.action === 'REJECT') {
    let evId: bigint | null = null;
    if (parsed.data.signature || parsed.data.useStoredSignature) {
      const sig = await resolveApprovalSignature({
        actorId: BigInt(session.userId),
        dataUrl: parsed.data.signature ?? null,
        useStoredSignature: parsed.data.useStoredSignature,
      });
      if (!('error' in sig)) {
        const ev = await recordApproval({
          actorId: BigInt(session.userId),
          delegatedFromId: delegation.delegatedFromId,
          signatureId: sig.signatureId,
          signatureRef: sig.signatureRef,
          resourceType: 'leave_request',
          resourceId: id.toString(),
          action: 'REJECT',
          comment: parsed.data.comment ?? null,
          ipAddress,
        });
        evId = ev.id;
      }
    }
    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: BigInt(session.userId), approvalEventId: evId },
    });
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'LEAVE_REQUEST_REJECT',
        resourceType: 'leave_request',
        resourceId: id.toString(),
        ipAddress,
        metadata: { fromStatus: target.status, approvalEventId: evId?.toString() ?? null } as object,
      },
    });
    return NextResponse.json({ ok: true, status: 'REJECTED', approvalEventId: evId?.toString() ?? null });
  }

  /* ───── APPROVE — 서명 (관리자 역할은 저장 서명 자동 시도, 없으면 서명 없이 처리) ───── */
  const wantSig = parsed.data.signature || parsed.data.useStoredSignature;
  if (!wantSig && !isAdminRole) {
    return NextResponse.json({ error: 'signature_required' }, { status: 400 });
  }
  const sigResult = await resolveApprovalSignature({
    actorId: BigInt(session.userId),
    dataUrl: parsed.data.signature ?? null,
    useStoredSignature: parsed.data.useStoredSignature ?? isAdminRole,
  });
  const sig = 'error' in sigResult ? null : sigResult;
  if (!sig && !isAdminRole) {
    return NextResponse.json({ error: 'signature_' + (sigResult as { error: string }).error }, { status: 400 });
  }

  /* ───── APPROVE 단계 1: PENDING → IN_REVIEW ───── */
  if (target.status === 'PENDING') {
    if (!canStage1) {
      return NextResponse.json({
        error: 'stage1_position_required',
        hint: `1차 결재 가능 직책: ${policy.stage1.join(', ')}`,
        actorPosition: actorPositionCode,
      }, { status: 403 });
    }
    const ev = await recordApproval({
      actorId: BigInt(session.userId),
      delegatedFromId: delegation.delegatedFromId,
      signatureId: sig?.signatureId ?? null,
      signatureRef: sig?.signatureRef ?? null,
      resourceType: 'leave_request',
      resourceId: id.toString(),
      action: 'APPROVE',
      comment: parsed.data.comment ?? '1차 결재',
      ipAddress,
    });
    /* 관리자 역할 또는 stage2 권한자가 1차 결재 시 → 즉시 최종 단계로 진행 */
    if (canStage2) {
      return await finalizeApprove({
        target, sig, delegation, ev,
        actorId: BigInt(session.userId),
        actorRole: session.role,
        ipAddress,
        comment: parsed.data.comment ?? '관리자 직접 결재 (1차+최종)',
        firstEventId: ev.id,
      });
    }
    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'IN_REVIEW',
        firstApprovedBy: BigInt(session.userId),
        firstApprovalEventId: ev.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'LEAVE_REQUEST_FIRST_APPROVE',
        resourceType: 'leave_request',
        resourceId: id.toString(),
        ipAddress,
        metadata: { approvalEventId: ev.id.toString(), signatureRef: sig?.signatureRef ?? null } as object,
      },
    });
    return NextResponse.json({
      ok: true,
      status: 'IN_REVIEW',
      stage: 'first',
      approvalEventId: ev.id.toString(),
      signatureRef: sig?.signatureRef ?? null,
    });
  }

  /* ───── APPROVE 단계 2: IN_REVIEW → APPROVED (stage2 권한자만) ───── */
  if (target.status === 'IN_REVIEW') {
    if (!canStage2) {
      return NextResponse.json({
        error: 'stage2_position_required',
        hint: `최종 결재 가능 직책: ${policy.stage2.join(', ')}`,
        actorPosition: actorPositionCode,
      }, { status: 403 });
    }
    const ev = await recordApproval({
      actorId: BigInt(session.userId),
      delegatedFromId: delegation.delegatedFromId,
      signatureId: sig?.signatureId ?? null,
      signatureRef: sig?.signatureRef ?? null,
      resourceType: 'leave_request',
      resourceId: id.toString(),
      action: 'APPROVE',
      comment: parsed.data.comment ?? '최종 결재',
      ipAddress,
    });
    return await finalizeApprove({
      target, sig, delegation, ev,
      actorId: BigInt(session.userId),
      actorRole: session.role,
      ipAddress,
      comment: parsed.data.comment ?? null,
      firstEventId: target.firstApprovalEventId,
    });
  }

  return NextResponse.json({ error: 'invalid_transition', current: target.status }, { status: 409 });
}

/** 최종 결재 완료 — 잔여 차감 + LeaveRequest 상태 업데이트 + audit */
async function finalizeApprove(params: {
  target: { id: bigint; workerId: bigint; requestType: string; startDate: Date; endDate: Date };
  sig: { signatureId: bigint; signatureRef: string; dataUrl: string } | null;
  delegation: { delegatedFromId: bigint | null };
  ev: { id: bigint };
  actorId: bigint;
  actorRole: import('@prisma/client').Role;
  ipAddress: string | null;
  comment: string | null;
  firstEventId: bigint | null;
}) {
  const { target } = params;
  const days = leaveDays(target.requestType, target.startDate, target.endDate);

  /* 연차/반차 잔여 차감 — 잔액 레코드 없으면 법정 기준(15일)으로 자동 생성 */
  if (ANNUAL_TYPES.has(target.requestType)) {
    const year = target.startDate.getFullYear();
    const balance = await prisma.annualLeaveBalance.upsert({
      where: { workerId_year: { workerId: target.workerId, year } },
      create: { workerId: target.workerId, year, granted: 15, used: 0, carriedOver: 0 },
      update: {},
    });
    const remaining = Number(balance.granted) + Number(balance.carriedOver) - Number(balance.used);
    if (remaining < days) {
      return NextResponse.json({ error: 'insufficient_balance', remaining, required: days }, { status: 409 });
    }
    await prisma.annualLeaveBalance.update({
      where: { workerId_year: { workerId: target.workerId, year } },
      data: { used: { increment: days } },
    });
  }

  await prisma.leaveRequest.update({
    where: { id: target.id },
    data: {
      status: 'APPROVED',
      approvedBy: params.actorId,
      approvalEventId: params.ev.id,
      finalApprovedBy: params.actorId,
      finalApprovalEventId: params.ev.id,
      ...(params.firstEventId == null
        ? { firstApprovedBy: params.actorId, firstApprovalEventId: params.ev.id }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: 'LEAVE_REQUEST_FINAL_APPROVE',
      resourceType: 'leave_request',
      resourceId: target.id.toString(),
      ipAddress: params.ipAddress,
      metadata: {
        type: target.requestType,
        days,
        approvalEventId: params.ev.id.toString(),
        signatureRef: params.sig?.signatureRef ?? null,
        firstEventId: params.firstEventId?.toString() ?? null,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    status: 'APPROVED',
    stage: 'final',
    days,
    approvalEventId: params.ev.id.toString(),
    signatureRef: params.sig?.signatureRef ?? null,
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const target = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target.status !== 'PENDING') {
    return NextResponse.json({ error: 'already_decided' }, { status: 409 });
  }

  /* 본인 또는 가시범위 내 관리자만 */
  const isOwner = target.workerId.toString() === session.userId;
  const isManager = canManageUsers(session.role);
  if (!isOwner && !isManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (isManager && !isOwner) {
    const u = await prisma.user.findFirst({ where: { id: target.workerId, ...userScope(session) }, select: { id: true } });
    if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.leaveRequest.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LEAVE_REQUEST_CANCEL',
      resourceType: 'leave_request',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });
  return NextResponse.json({ ok: true });
}
