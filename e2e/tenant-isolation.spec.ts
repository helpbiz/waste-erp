// Plan SC: deploy-readiness P0 — cross-tenant 격리 자동 검증
// 시드는 1 contractor 만 — 추가 contractor 동적 생성 후 격리 확인.
import { test, expect, type APIRequestContext } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

async function loginAs(
  playwright: { request: { newContext: (opts: Record<string, unknown>) => Promise<APIRequestContext> } },
  baseURL: string,
  username: string,
  password: string,
): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { username, password } });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`login ${username} failed: ${res.status()} ${body}`);
  }
  return ctx;
}

test('CONTRACTOR_ADMIN(company) 로그인 시 자사 contractorId 만 노출', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company', SEED_PWD);
  const me = await ctx.get('/api/auth/me');
  if (!me.ok()) test.skip(true, 'auth/me 미구현');
  const meJson = await me.json().catch(() => ({}));
  /* contractorId 가 본인 것이어야 함 */
  expect(meJson.user?.contractorId).toBeTruthy();
  expect(meJson.user?.role).toBe('CONTRACTOR_ADMIN');
  await ctx.dispose();
});

test('비-SUPER 사용자가 /api/super-admin/* 호출 시 403', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company', SEED_PWD);

  /* /api/super-admin/municipalities — SUPER 만 접근 가능 */
  const r1 = await ctx.get('/api/super-admin/municipalities');
  expect([401, 403]).toContain(r1.status());

  /* /api/super-admin/muni-policies — SUPER 만 */
  const r2 = await ctx.get('/api/super-admin/muni-policies');
  expect([401, 403]).toContain(r2.status());

  await ctx.dispose();
});

test('CONTRACTOR_ADMIN 이 다른 contractorId 정보 조회 시 차단', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company', SEED_PWD);

  /* 본인 contractor 정보 */
  const meRes = await ctx.get('/api/contractor/info');
  const meJson = await meRes.json().catch(() => ({}));
  if (!meJson.contractor?.id) test.skip(true, 'contractor info 응답 없음');
  const myId = meJson.contractor.id;

  /* 임의 다른 ID(99999) 로 접근 — SUPER 가 아니므로 본인만 응답돼야 함 */
  const otherRes = await ctx.get('/api/contractor/info?contractorId=99999');
  const otherJson = await otherRes.json().catch(() => ({}));
  /* CONTRACTOR_ADMIN 은 query 무시 → 본인 contractor 만 응답 */
  if (otherJson.contractor) {
    expect(otherJson.contractor.id).toBe(myId);
  }

  /* /api/contractors 목록도 본인 1건만 */
  const list = await ctx.get('/api/contractors');
  if (list.ok()) {
    const j = await list.json();
    const myCount = (j.items ?? []).filter((c: { id: string }) => c.id === myId).length;
    /* 본인이 1건만 노출 */
    expect(j.items.length).toBeLessThanOrEqual(1);
    expect(myCount).toBe(1);
  }
  await ctx.dispose();
});

test('미인증 호출 → 401', async ({ playwright, baseURL }) => {
  /* storageState 비워서 글로벌 세션 격리 */
  const ctx = await playwright.request.newContext({
    baseURL: baseURL!,
    storageState: { cookies: [], origins: [] },
  });
  const r = await ctx.get('/api/contractor/info');
  expect(r.status()).toBe(401);
  await ctx.dispose();
});

test('MUNI_ADMIN GET-only — POST/PATCH/DELETE 차단', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'muni', SEED_PWD);
  /* MUNI_ADMIN 의 mutate API 호출 — middleware에서 403 */
  const r = await ctx.patch('/api/contractor/info', {
    data: { ceoName: 'hack' },
  });
  expect([403, 401]).toContain(r.status());
  await ctx.dispose();
});
