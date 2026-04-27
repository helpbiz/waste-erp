/**
 * ApprovalEvent — 도메인 액션과 결재 통합
 * Design Ref: §2.1 D5
 */
import { prisma } from './db';

export type RecordApprovalInput = {
  actorId: bigint;
  delegatedFromId?: bigint | null;
  signatureId?: bigint | null;
  signatureRef?: string | null;
  resourceType: 'leave_request' | 'leave_balance' | 'user_create' | 'user_disable';
  resourceId: string;
  action: 'APPROVE' | 'REJECT' | 'GRANT' | 'CREATE' | 'DISABLE';
  comment?: string | null;
  ipAddress?: string | null;
};

export async function recordApproval(input: RecordApprovalInput): Promise<{ id: bigint }> {
  const ev = await prisma.approvalEvent.create({
    data: {
      actorId: input.actorId,
      delegatedFromId: input.delegatedFromId ?? null,
      signatureId: input.signatureId ?? null,
      signatureRef: input.signatureRef ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      comment: input.comment ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });
  return { id: ev.id };
}
