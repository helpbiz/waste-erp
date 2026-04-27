/**
 * ApprovalPolicy — 직책 기반 결재 권한 매트릭스
 * 기본 정책 (시드):
 *   stage 1: TEAM_LEAD, HEAD, DIRECTOR, EXEC, CEO  → 1차 결재
 *   stage 2: CEO                                    → 최종 결재
 */
import { prisma } from './db';

export type StagePolicy = {
  stage: 1 | 2;
  positionCodes: string[];
};

const cache = new Map<string, { stage1: string[]; stage2: string[]; loadedAt: number }>();
const TTL_MS = 30 * 1000;

export async function getApprovalPolicy(
  contractorId: bigint,
  resourceType: string = 'leave_request'
): Promise<{ stage1: string[]; stage2: string[] }> {
  const key = `${contractorId}:${resourceType}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) {
    return { stage1: cached.stage1, stage2: cached.stage2 };
  }
  const rows = await prisma.approvalPolicy.findMany({
    where: { contractorId, resourceType, active: true },
  });
  const stage1 = (rows.find((r) => r.stage === 1)?.positionCodes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const stage2 = (rows.find((r) => r.stage === 2)?.positionCodes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  cache.set(key, { stage1, stage2, loadedAt: Date.now() });
  return { stage1, stage2 };
}

export function invalidatePolicyCache() { cache.clear(); }

/** 기본 정책 (시드/Fallback) */
export const DEFAULT_POLICY = {
  leave_request: {
    stage1: ['TEAM_LEAD', 'HEAD', 'DIRECTOR', 'EXEC', 'CEO'],
    stage2: ['CEO'],
  },
};

/** actor의 직책 코드가 stage 결재 권한이 있는지 */
export function canApproveStage(positionCode: string | null | undefined, stagePolicy: string[]): boolean {
  if (!positionCode) return false;
  if (stagePolicy.length === 0) {
    /* 정책 미설정 시 fallback */
    return DEFAULT_POLICY.leave_request.stage1.includes(positionCode);
  }
  return stagePolicy.includes(positionCode);
}
