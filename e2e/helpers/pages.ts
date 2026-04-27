// Design Ref: §11 — admin 페이지 목록을 spec간 공유
// INTERNAL_ADMIN(test user) 가시 영역만 포함. SUPER_ADMIN 전용은 별도 spec.
export const ADMIN_PAGES = [
  '/attendance',
  '/users',
  '/safety',
  '/dashboard',
  '/vehicles',
  '/payroll',
  '/health',
  '/bulky-waste',
  '/performance',
  '/complaints',
  '/reports',
] as const;

export type AdminPage = (typeof ADMIN_PAGES)[number];
