// Design Ref: Phase 1 P1-1 — Tab 3 권한설정 CSV 직렬화 라운드트립 smoke test
// Plan SC-01: POST 후 GET 응답이 입력 권한 집합과 동일한지 검증
import { test, expect } from '@playwright/test';

/* SUPER_ADMIN 전용 — Set-Cookie 직접 추출 + extraHTTPHeaders 로 전달 (CI secure flag 회피) */
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

type LoginResult = { ctx: import('@playwright/test').APIRequestContext };

async function loginAsSuper(
  baseURL: string,
  playwright: { request: { newContext: (opts: Record<string, unknown>) => Promise<import('@playwright/test').APIRequestContext> } },
): Promise<LoginResult> {
  /* 1) 임시 ctx로 로그인 → Set-Cookie 헤더 추출 */
  const tmp = await playwright.request.newContext({ baseURL });
  const res = await tmp.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`super login failed: ${res.status()} ${body}`);
  }
  /* Set-Cookie 헤더에서 session 쿠키만 발췌 */
  const setCookie = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')?.value ?? '';
  const sessionCookie = setCookie.split(';')[0]; // "session=eyJ..."
  await tmp.dispose();

  /* 2) 신규 ctx에 Cookie 헤더로 직접 부착 — secure 플래그 무시하고 강제 전달 */
  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: sessionCookie },
  });
  return { ctx };
}

test('CSV 직렬화 라운드트립: POST → GET 권한 집합 동일', async ({ playwright, baseURL }) => {
  const { ctx } = await loginAsSuper(baseURL!, playwright);

  /* 1. 현재 정책 조회 */
  const before = await ctx.get('/api/super-admin/muni-policies');
  expect(before.ok(), 'GET muni-policies should succeed').toBeTruthy();
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
});

test('region 필드 응답 포함 (P1-2 검증)', async ({ playwright, baseURL }) => {
  const { ctx } = await loginAsSuper(baseURL!, playwright);

  const res = await ctx.get('/api/super-admin/muni-policies');
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.items.length).toBeGreaterThan(0);
  /* 모든 item이 region 키를 가져야 함 (값은 null 가능) */
  for (const item of json.items) {
    expect(item, `item ${item.id} should have region key`).toHaveProperty('region');
  }
});
