/**
 * Delegation — 결재 위임 규칙 해소
 *
 * 사용 흐름:
 *   - APPROVE 진입 시 actor=결재자(B)
 *   - 만약 B가 누군가(A)로부터 위임받은 활성 규칙이 있으면 → 'B가 A 대신 대결' 표시 (delegatedFromId=A)
 *   - 단순 모델: 결재자 본인 결재 + 위임받은 결재가 모두 가능. 위임자(A)가 직접 결재해도 무방.
 *   - 향후 (예: 팀장 결재 필수 정책) 도입 시 권한 체크에서 결정.
 */
import { prisma } from './db';

export type ResolveInput = {
  actorId: bigint;
  resourceType: 'leave_request' | 'leave_balance' | 'user_create' | 'user_disable';
  asOf?: Date;
};

export type DelegationContext = {
  delegatedFromId: bigint | null;          // null = 본인 결재
  delegatedFromName: string | null;
  ruleId: bigint | null;
  reason: string | null;
};

export async function resolveDelegationFor(input: ResolveInput): Promise<DelegationContext> {
  const asOf = input.asOf ?? new Date();
  /* delegate=actor, 위임 영역 = resourceType 또는 '*', 활성 + 기간 내 */
  const rule = await prisma.delegationRule.findFirst({
    where: {
      delegateId: input.actorId,
      active: true,
      startsAt: { lte: asOf },
      endsAt: { gte: asOf },
      OR: [
        { resourceType: input.resourceType },
        { resourceType: '*' },
      ],
    },
    include: { delegator: { select: { id: true, name: true } } },
    orderBy: { id: 'desc' },
  });

  if (!rule) return { delegatedFromId: null, delegatedFromName: null, ruleId: null, reason: null };
  return {
    delegatedFromId: rule.delegatorId,
    delegatedFromName: rule.delegator.name,
    ruleId: rule.id,
    reason: rule.reason,
  };
}
