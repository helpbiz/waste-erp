// Design Ref: Phase 1 P1-1 — Tab 3 권한설정 CSV 직렬화 라운드트립 smoke test
// Plan SC-01: POST 후 GET 응답이 입력 권한 집합과 동일한지 검증
// page.request 사용 — 브라우저 컨텍스트가 cookie + secure flag 자동 처리
import { test, expect } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

/* SUPER_ADMIN 권한이 필요 — global setup의 INTERNAL_ADMIN 쿠키를 super 로그인으로 덮어씀 */
test.beforeEach(async ({ page }) => {
  /* 빈 페이지로 이동해 동일 origin 컨텍스트 확보 후 로그인 API 호출 */
  await page.goto('/login');
  const res = await page.request.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`super login failed: ${res.status()} ${body}`);
  }
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
  /* 모든 item이 region 키를 가져야 함 (값은 null 가능) */
  for (const item of json.items) {
    expect(item, `item ${item.id} should have region key`).toHaveProperty('region');
  }
});
