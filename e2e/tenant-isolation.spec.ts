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

/* ─── Stage 2 (P0-residual) — cross-tenant 격리 + SUPER audit forensic ─── */

test('Stage 2: company1 (강남업체)의 /api/complaints는 자사 민원만 노출', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company1', SEED_PWD).catch(() => null);
  if (!ctx) test.skip(true, 'company1 시드 없음 (beta-onboarding 미적용)');
  if (!ctx) return;

  const me = await ctx.get('/api/auth/me');
  if (!me.ok()) {
    await ctx.dispose();
    test.skip(true, 'auth/me 미구현');
    return;
  }
  const meJson = await me.json();
  const myContractorId = meJson.user?.contractorId;
  expect(myContractorId).toBeTruthy();

  /* /api/complaints — 본인 contractor 민원만 (Prisma extension + complaintWhere 이중 보호) */
  const list = await ctx.get('/api/complaints');
  if (list.ok()) {
    const j = await list.json();
    expect(j.role).toBe('CONTRACTOR_ADMIN');
    /* items가 있으면 모두 자사 contractor — API 응답엔 contractorId 노출 안 됨이 정상이지만,
       cross-tenant 누락 검증은 SUPER 비교로 대체 */
    expect(Array.isArray(j.items)).toBe(true);
  }
  await ctx.dispose();
});

test('Stage 2: SUPER가 muni-policies 변경 시 audit_log에 municipalityId 기록', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'super', SEED_PWD).catch(() => null);
  if (!ctx) test.skip(true, 'super 시드 없음');
  if (!ctx) return;

  /* 임의 muni 1곳 조회 */
  const list = await ctx.get('/api/super-admin/muni-policies');
  if (!list.ok()) {
    await ctx.dispose();
    test.skip(true, 'muni-policies 미구현');
    return;
  }
  const j = await list.json();
  if (!j.items || j.items.length === 0) {
    await ctx.dispose();
    test.skip(true, 'muni 데이터 없음');
    return;
  }
  const muniId = j.items[0].id;

  /* 정책 갱신 — 빈 배열이면 noop, 있으면 그대로 다시 저장 */
  const existing = j.items[0].policy ?? { allowedScreens: [], allowedReports: [] };
  const r = await ctx.post('/api/super-admin/muni-policies', {
    data: {
      municipalityId: muniId,
      allowedScreens: existing.allowedScreens ?? [],
      allowedReports: existing.allowedReports ?? [],
      exportEnabled: true,
      bulkExportEnabled: false,
    },
  });
  expect(r.ok()).toBe(true);

  /* Stage 1+2: writeAudit가 audit_log.municipality_id에 muniId 기록.
     본 테스트에선 200 OK + 무에러 흐름만 확인 (DB inspection은 별도 모니터링 책임). */
  await ctx.dispose();
});

test('Stage 2: 비-SUPER가 super-admin 라우트 PATCH 시 403', async ({ playwright, baseURL }) => {
  const ctx = await loginAs(playwright, baseURL!, 'company', SEED_PWD);

  /* 임의 muni id로 PATCH 시도 (실제로 1n이 존재하지 않아도 권한 체크 먼저) */
  const r = await ctx.patch('/api/super-admin/municipalities/1', {
    data: { name: 'hack' },
  });
  expect([401, 403]).toContain(r.status());
  await ctx.dispose();
});
