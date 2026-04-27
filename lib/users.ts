/**
 * 사용자관리 헬퍼 — 가시범위(scope), 연차 부여 정책
 *
 * 권한 정책:
 *  - SUPER_ADMIN: 전체
 *  - CONTRACTOR_ADMIN, INTERNAL_ADMIN: 본인 위탁업체
 *  - MUNI_ADMIN: 본인 지자체 산하 위탁업체 (read-only — middleware에서 차단)
 *  - WORKER: 본인만 (조회)
 *
 * 연차 정책 (근로기준법 §60):
 *  - 1년차(입사 1년 미만): 매월 만근 시 1일, 최대 11일
 *  - 1년차 이상: 15일 (직전년도 80% 이상 출근 시)
 *  - 3년차부터 2년마다 +1일, 한도 25일
 *  - MVP 단계: 자동계산 결과를 'recommendedGrant'로 제안, 관리자 수동 부여
 */
import type { Prisma, Role } from '@prisma/client';

export type ScopeSession = {
  role: Role;
  contractorId: string | null;
  municipalityId: string | null;
};

/** User 목록 조회 시 가시범위 where 절 */
export function userScope(session: ScopeSession): Prisma.UserWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    return session.contractorId ? { contractorId: BigInt(session.contractorId) } : { id: BigInt(-1) };
  }
  if (session.role === 'MUNI_ADMIN') {
    return session.municipalityId
      ? { contractor: { municipalityId: BigInt(session.municipalityId) } }
      : { id: BigInt(-1) };
  }
  /* WORKER */
  return { id: BigInt(-1) };
}

/** 사용자 등록·수정 권한 (mutate) */
export function canManageUsers(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

/** 근속연수 계산 — 입사일 기준 (오늘 또는 지정일) */
export function tenureYears(hireDate: Date | null, asOf: Date = new Date()): number {
  if (!hireDate) return 0;
  const ms = asOf.getTime() - hireDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * 연차 권장 부여일수 — 근로기준법 §60
 * @param hireDate 입사일
 * @param asOf 평가일 (기본 오늘)
 * @returns { years, days } 근속년수 + 권장 일수
 */
export function recommendedAnnualLeaveDays(
  hireDate: Date | null,
  asOf: Date = new Date()
): { years: number; days: number; rule: string } {
  if (!hireDate) return { years: 0, days: 0, rule: '입사일 미등록' };
  const years = tenureYears(hireDate, asOf);

  if (years < 1) {
    /* 1년 미만 — 만근 월 수 추정 (간단화: 입사일~오늘 개월 수 - 1) */
    const months = Math.max(
      0,
      (asOf.getFullYear() - hireDate.getFullYear()) * 12 +
        (asOf.getMonth() - hireDate.getMonth()) -
        (asOf.getDate() < hireDate.getDate() ? 1 : 0)
    );
    const days = Math.min(11, Math.max(0, months));
    return { years, days, rule: `1년 미만 (만근 ${months}개월 → ${days}일)` };
  }

  /* 1년 이상 — 15일 + (years - 1) // 2 */
  const extra = Math.floor((years - 1) / 2);
  const days = Math.min(25, 15 + extra);
  return { years, days, rule: `${years}년차 (15 + ${extra} = ${days}일, 한도 25)` };
}

/** 잔여일수 = granted + carriedOver - used */
export function leaveRemaining(b: { granted: unknown; used: unknown; carriedOver: unknown }): number {
  const toNum = (v: unknown) => (typeof v === 'object' && v !== null ? Number(v.toString()) : Number(v ?? 0));
  return toNum(b.granted) + toNum(b.carriedOver) - toNum(b.used);
}

/** 연차 사용일수 계산 — startDate~endDate 양끝 포함 (주말 제외 X, MVP 단순화) */
export function leaveDayCount(startDate: Date, endDate: Date): number {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}
