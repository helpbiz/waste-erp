/**
 * 작업자 익명 건의함 — 공유 로직 (2026-05-02).
 *
 * 익명성 보장:
 *  - 작성 시 userId 저장 금지. contractorId(필수) + departmentId/positionCode(통계용)만.
 *  - 작성자 본인 식별: 클라가 발급한 UUID를 SHA-256 해시 후 저장.
 *    토큰 분실 시 누구도 자기 글을 식별할 수 없음 (= 익명성 보강).
 *  - 부서/직책 인원 < MIN_GROUP_SIZE 면 응답에서 마스킹.
 */
import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

export const MIN_GROUP_SIZE = 3;

export type CategoryCode = 'WORK_ENV' | 'EQUIPMENT' | 'SAFETY' | 'MANAGEMENT' | 'WELFARE' | 'OTHER';

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  WORK_ENV: '업무환경',
  EQUIPMENT: '장비/도구',
  SAFETY: '안전',
  MANAGEMENT: '관리/소통',
  WELFARE: '복지/처우',
  OTHER: '기타',
};

export type StatusCode = 'NEW' | 'REVIEWING' | 'ANSWERED' | 'ARCHIVED';

export const STATUS_LABELS: Record<StatusCode, string> = {
  NEW: '신규',
  REVIEWING: '검토 중',
  ANSWERED: '답변 완료',
  ARCHIVED: '보관',
};

/** UUID(또는 임의 문자열) → SHA-256 hex (64자). 본인 글 식별 비교용. */
export function hashAuthorToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * 부서/직책 인원이 적으면 익명성 위협 → 마스킹.
 * 대상 contractor 의 활성 사용자(WORKER 한정)를 1번 쿼리해 카운트.
 */
export async function buildSmallGroupMasks(contractorId: bigint): Promise<{
  smallDepartmentIds: Set<string>;
  smallPositionCodes: Set<string>;
}> {
  const workers = await prisma.user.findMany({
    where: { contractorId, role: 'WORKER', status: 'ACTIVE' },
    select: { departmentId: true, position: { select: { code: true } } },
  });

  const deptCount = new Map<string, number>();
  const posCount = new Map<string, number>();
  for (const w of workers) {
    if (w.departmentId) {
      const k = w.departmentId.toString();
      deptCount.set(k, (deptCount.get(k) ?? 0) + 1);
    }
    if (w.position?.code) {
      posCount.set(w.position.code, (posCount.get(w.position.code) ?? 0) + 1);
    }
  }
  const smallDepartmentIds = new Set<string>();
  const smallPositionCodes = new Set<string>();
  for (const [k, n] of deptCount) if (n < MIN_GROUP_SIZE) smallDepartmentIds.add(k);
  for (const [k, n] of posCount) if (n < MIN_GROUP_SIZE) smallPositionCodes.add(k);
  return { smallDepartmentIds, smallPositionCodes };
}
