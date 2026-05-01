/**
 * 공지사항 audience 정책 — 작성자 role 별 선택지 + 뷰어 role 별 가시 audience 매핑.
 *
 * audience 카탈로그
 * ─────────────────────────────────────────────
 *  ALL    — 작업자 포함 전체 (모든 role 이 봄)
 *  OWNER  — 회사 대표 (CONTRACTOR_ADMIN) 만 봄
 *  ADMIN  — 회사 + 관리자 (CONTRACTOR_ADMIN + INTERNAL_ADMIN) 가 봄
 *  WORKER — 근로자 (WORKER) 만 봄
 *  MUNI   — 지자체 담당자 (MUNI_ADMIN) 만 봄
 *
 * 작성자 role 별 선택 가능 audience (사용자 요구사항 2026-05-02):
 * ─────────────────────────────────────────────
 *  CONTRACTOR_ADMIN / INTERNAL_ADMIN → [ADMIN, WORKER, ALL]   (지자체 제외)
 *  MUNI_ADMIN                        → [OWNER, ADMIN, ALL]    (작업자 직접 지정 X, 전체에 포함됨)
 *  SUPER_ADMIN                       → [ALL, OWNER, ADMIN, WORKER, MUNI]
 */

export type AudienceValue = 'ALL' | 'OWNER' | 'ADMIN' | 'WORKER' | 'MUNI';

export const AUDIENCE_ALL_VALUES: AudienceValue[] = ['ALL', 'OWNER', 'ADMIN', 'WORKER', 'MUNI'];

export const AUDIENCE_LABEL: Record<AudienceValue, string> = {
  ALL:    '전체 (작업자 포함)',
  OWNER:  '회사 대표만',
  ADMIN:  '회사 + 관리자',
  WORKER: '근로자만',
  MUNI:   '지자체 담당자',
};

/* 작성자 role → 작성 시 선택 가능한 audience 옵션 (UI 드롭다운) */
export function audienceOptionsForCreator(role: string): AudienceValue[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['ALL', 'OWNER', 'ADMIN', 'WORKER', 'MUNI'];
    case 'CONTRACTOR_ADMIN':
    case 'INTERNAL_ADMIN':
      /* 지자체 직접 지정 금지 — 사용자 요구사항 */
      return ['ADMIN', 'WORKER', 'ALL'];
    case 'MUNI_ADMIN':
      /* 회사 / 회사+관리자 / 작업자 포함 전체 */
      return ['OWNER', 'ADMIN', 'ALL'];
    default:
      return [];
  }
}

/* 작성자가 audience 값을 사용할 수 있는지 검증 (서버 측 강제) */
export function isAudienceAllowedFor(role: string, audience: AudienceValue): boolean {
  return audienceOptionsForCreator(role).includes(audience);
}

/* 뷰어 role → 자신이 볼 수 있는 audience 값들 */
export function visibleAudiencesForViewer(role: string): AudienceValue[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['ALL', 'OWNER', 'ADMIN', 'WORKER', 'MUNI'];
    case 'CONTRACTOR_ADMIN':
      /* 회사 대표 — OWNER + ADMIN + ALL */
      return ['ALL', 'OWNER', 'ADMIN'];
    case 'INTERNAL_ADMIN':
      /* 회사 일반관리자 — ADMIN + ALL (OWNER 는 대표 전용이라 제외) */
      return ['ALL', 'ADMIN'];
    case 'WORKER':
      return ['ALL', 'WORKER'];
    case 'MUNI_ADMIN':
      return ['ALL', 'MUNI'];
    default:
      return ['ALL'];
  }
}
