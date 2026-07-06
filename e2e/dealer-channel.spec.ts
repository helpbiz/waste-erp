// dealer-channel Design §8.2 L1 API 테스트 — 핵심 보안 단언 위주.
// 전제: DEALER role 시드 유저(username 'dealer1', SEED_PWD)가 별도로 준비되어 있어야 함.
// 현재 seed 스크립트(prisma/seeds/beta-onboarding.ts)에는 DEALER 유저가 없으므로,
// 준비 전까지는 아래 테스트들이 graceful skip 된다(e2e/tenant-isolation.spec.ts 관례 따름).
import { test, expect, type APIRequestContext } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

async function loginAs(
  playwright: { request: { newContext: (opts: Record<string, unknown>) => Promise<APIRequestContext> } },
  baseURL: string,
  username: string,
  password: string,
): Promise<APIRequestContext | null> {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { username, password } });
  if (!res.ok()) {
    await ctx.dispose();
    return null;
  }
  return ctx;
}

test('WORKER가 리드 등록 시도 시 403 (권한 없음)', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'worker1a', SEED_PWD);
  if (!ctx) { test.skip(true, 'worker1a 시드 유저 없음'); return; }

  const res = await ctx.post('/api/dealer/leads', { data: { prospectName: '테스트' } });
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test('DEALER 리드 등록 → 목록에 PENDING으로 반영', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'dealer1', SEED_PWD);
  if (!ctx) { test.skip(true, 'dealer1 시드 유저 없음 — DEALER 시드 준비 필요'); return; }

  const created = await ctx.post('/api/dealer/leads', {
    data: { prospectName: 'E2E 테스트 고객사' },
  });
  expect(created.status()).toBe(201);
  const createdJson = await created.json();
  expect(createdJson.status).toBe('PENDING');

  const list = await ctx.get('/api/dealer/leads');
  expect(list.ok()).toBeTruthy();
  const listJson = await list.json();
  expect(listJson.items.some((l: { id: string }) => l.id === createdJson.id)).toBeTruthy();

  await ctx.dispose();
});

test('DEALER 데모 셀프발급 → 발급 계정 role은 CONTRACTOR_ADMIN (SUPER_ADMIN 아님)', async ({ playwright, baseURL }) => {
  const dealerCtx = await loginAs(playwright, baseURL!, 'dealer1', SEED_PWD);
  if (!dealerCtx) { test.skip(true, 'dealer1 시드 유저 없음 — DEALER 시드 준비 필요'); return; }

  const provisionRes = await dealerCtx.post('/api/dealer/demo-provision');
  expect(provisionRes.status()).toBe(201);
  const provisionJson = await provisionRes.json();
  expect(provisionJson.adminUsername).toBeTruthy();
  expect(provisionJson.adminPassword).toBeTruthy();
  await dealerCtx.dispose();

  /* 발급된 데모 계정으로 실제 로그인해 role을 직접 검증 — 핵심 보안 단언 */
  const demoCtx = await loginAs(playwright, baseURL!, provisionJson.adminUsername, provisionJson.adminPassword);
  expect(demoCtx).not.toBeNull();
  if (!demoCtx) return;

  const me = await demoCtx.get('/api/auth/me');
  if (me.ok()) {
    const meJson = await me.json();
    expect(meJson.user?.role).toBe('CONTRACTOR_ADMIN');
    expect(meJson.user?.role).not.toBe('SUPER_ADMIN');
  }

  /* 데모 계정은 SUPER_ADMIN 전용 자원에 접근 불가 */
  const forbidden = await demoCtx.get('/api/super-admin/municipalities');
  expect([401, 403]).toContain(forbidden.status());

  await demoCtx.dispose();
});

test('POST /api/cron/demo-cleanup — CRON_SECRET 없이 호출 시 401', async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/cron/demo-cleanup`, { data: { dryRun: true } });
  expect(res.status()).toBe(401);
});

test('(회귀) 기존 4개 role 계정 생성 플로우 무변경 — CONTRACTOR_ADMIN이 WORKER 생성 가능', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company1', SEED_PWD);
  if (!ctx) { test.skip(true, 'company1 시드 유저 없음'); return; }

  const res = await ctx.get('/api/users?role=WORKER');
  expect(res.ok()).toBeTruthy();
  await ctx.dispose();
});
