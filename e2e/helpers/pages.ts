// Design Ref: §11 — admin 페이지 목록을 spec간 공유
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
  '/super-admin',
  '/reports',
] as const;

export type AdminPage = (typeof ADMIN_PAGES)[number];
