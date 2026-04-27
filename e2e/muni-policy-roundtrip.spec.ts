// Design Ref: Phase 1 P1-1 — Tab 3 권한설정 CSV 직렬화 라운드트립 smoke test
// Plan SC-01: POST 후 GET 응답이 입력 권한 집합과 동일한지 검증
// 테스트별 isolated APIRequestContext 로 super 직접 로그인 (storageState 의존 제거)
import { test, expect, type APIRequestContext } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

async function makeSuperContext(
  playwright: { request: { newContext: (opts: { baseURL: string }) => Promise<APIRequestContext> } },
  baseURL: string,
): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`super login failed: ${res.status()} ${body}`);
  }
  return ctx;
}

test('CSV 직렬화 라운드트립: POST → GET 권한 집합 동일', async ({ playwright, baseURL }) => {
  const ctx = await makeSuperContext(playwright, baseURL!);

  /* 1. 현재 정책 조회 */
  const before = await ctx.get('/api/super-admin/muni-policies');
  expect(before.ok(), `GET muni-policies should succeed; status=${before.status()}`).toBeTruthy();
  const beforeJson = await before.json();
  const target = beforeJson.items[0];
  if (!target) test.skip(true, 'no municipality available');

  /* 2. 임의 권한 세트로 POST */
  const screens = ['dashboard', 'users', 'attendance'];
  const reports = ['hr', 'attendance'];
  const post = await ctx.post('/api/super-admin/muni-policies', {
    data: {
      municipalityId: target.id,
      allowedScreens: screens,
      allowedReports: reports,
      exportEnabled: true,
      bulkExportEnabled: false,
      note: 'roundtrip-test',
    },
  });
  expect(post.ok(), `POST should succeed; status=${post.status()}`).toBeTruthy();

  /* 3. 다시 GET → 응답 검증 */
  const after = await ctx.get('/api/super-admin/muni-policies');
  const afterJson = await after.json();
  const updated = afterJson.items.find((m: { id: string }) => m.id === target.id);

  expect(updated.policy.allowedScreens.sort()).toEqual(screens.sort());
  expect(updated.policy.allowedReports.sort()).toEqual(reports.sort());
  expect(updated.policy.exportEnabled).toBe(true);
  expect(updated.policy.bulkExportEnabled).toBe(false);
  expect(updated.policy.note).toBe('roundtrip-test');

  await ctx.dispose();
});

test('region 필드 응답 포함 (P1-2 검증)', async ({ playwright, baseURL }) => {
  const ctx = await makeSuperContext(playwright, baseURL!);

  const res = await ctx.get('/api/super-admin/muni-policies');
  expect(res.ok(), `status=${res.status()}`).toBeTruthy();
  const json = await res.json();
  expect(json.items.length).toBeGreaterThan(0);
  for (const item of json.items) {
    expect(item, `item ${item.id} should have region key`).toHaveProperty('region');
  }

  await ctx.dispose();
});
