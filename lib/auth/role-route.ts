/**
 * Role → Route 매트릭스 (PWA Mobile UX Mastering / P0-7).
 *
 * 4 user role: company / manager / muni / worker. 실제 DB role 값과 매핑:
 *   - SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN, MUNI_ADMIN → 'admin' shell
 *   - WORKER → 'worker' shell. 기동반(RAPID) 분기는 메뉴 데이터 레벨에서 처리 (P1).
 *
 * 우선순위:
 *   1) explicitNext (URL ?next=/foo) — 사용자 의도 우선
 *   2) 모바일 + admin role → /dashboard
 *   3) 서버에서 내려준 redirectTo
 *   4) admin role fallback → /dashboard (사용자 요청 2026-05-01)
 *   5) 그 외 fallback → /complaints
 */

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'CONTRACTOR_ADMIN',
  'INTERNAL_ADMIN',
  'MUNI_ADMIN',
]);

export interface ResolveRouteInput {
  /** /api/auth/login 응답의 user.role */
  role?: string | null;
  /** 서버가 권장한 redirectTo */
  redirectTo?: string | null;
  /** URL ?next= */
  explicitNext?: string | null;
  /** 클라이언트 viewport 모바일 여부 */
  isMobile?: boolean;
}

export function resolveRoleRoute({
  role,
  redirectTo,
  explicitNext,
  isMobile,
}: ResolveRouteInput): string {
  if (explicitNext) return explicitNext;
  if (isMobile && role && ADMIN_ROLES.has(role)) return '/dashboard';
  if (redirectTo) return redirectTo;
  if (role && ADMIN_ROLES.has(role)) return '/dashboard';
  return '/complaints';
}

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}
