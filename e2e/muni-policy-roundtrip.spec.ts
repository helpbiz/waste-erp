// Design Ref: Phase 1 P1-1 — Tab 3 권한설정 CSV 직렬화 라운드트립 smoke test
// Plan SC-01: POST 후 GET 응답이 입력 권한 집합과 동일한지 검증
// UI 로그인으로 super 세션 확보 — 브라우저 cookie 처리 위임 (CI prod 모드 secure flag 회피)
import { test, expect } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

/* SUPER_ADMIN 권한 필요 — global setup의 INTERNAL_ADMIN cookie를 super UI 로그인으로 덮어씀 */
test.beforeEach(async ({ page, context }) => {
  /* 기존 세션 쿠키 제거 후 깨끗한 상태에서 super 로그인 */
  await context.clearCookies();
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('super');
  await page.locator('input[type="password"]').fill(SEED_PWD);
  await page.getByRole('button', { name: /^로그인$/ }).click();
  /* 로그인 성공 → admin 랜딩으로 이동. /login 에서 벗어나면 OK */
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
});

test('CSV 직렬화 라운드트립: POST → GET 권한 집합 동일', async ({ page }) => {
  /* 1. 현재 정책 조회 */
  const before = await page.request.get('/api/super-admin/muni-policies');
  expect(before.ok(), `GET muni-policies should succeed; status=${before.status()}`).toBeTruthy();
  const beforeJson = await before.json();
  const target = beforeJson.items[0];
  if (!target) test.skip(true, 'no municipality available');

  /* 2. 임의 권한 세트로 POST */
  const screens = ['dashboard', 'users', 'attendance'];
  const reports = ['hr', 'attendance'];
  const post = await page.request.post('/api/super-admin/muni-policies', {
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
  const after = await page.request.get('/api/super-admin/muni-policies');
  const afterJson = await after.json();
  const updated = afterJson.items.find((m: { id: string }) => m.id === target.id);

  expect(updated.policy.allowedScreens.sort()).toEqual(screens.sort());
  expect(updated.policy.allowedReports.sort()).toEqual(reports.sort());
  expect(updated.policy.exportEnabled).toBe(true);
  expect(updated.policy.bulkExportEnabled).toBe(false);
  expect(updated.policy.note).toBe('roundtrip-test');
});

test('region 필드 응답 포함 (P1-2 검증)', async ({ page }) => {
  const res = await page.request.get('/api/super-admin/muni-policies');
  expect(res.ok(), `status=${res.status()}`).toBeTruthy();
  const json = await res.json();
  expect(json.items.length).toBeGreaterThan(0);
  for (const item of json.items) {
    expect(item, `item ${item.id} should have region key`).toHaveProperty('region');
  }
});
