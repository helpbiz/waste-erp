// Design Ref: §8.3 — 로그인 redirect 흐름 검증
// Plan SC: FR-08
import { test, expect } from '@playwright/test';

// 이 spec은 비로그인 상태를 시뮬레이션해야 하므로 storageState 무효화
test.use({ storageState: { cookies: [], origins: [] } });

test('비로그인 → /attendance 접근 시 /login redirect', async ({ page }) => {
  await page.goto('/attendance');
  await expect(page).toHaveURL(/\/login/);
});

test('로그인 후 next 파라미터 경로로 복귀', async ({ page }) => {
  await page.goto('/attendance');
  await expect(page).toHaveURL(/\/login\?next=%2Fattendance/);

  // 셀렉터 견고: type 속성 + autocomplete로 매칭 (placeholder 변경에 강함)
  await page.locator('input[autocomplete="username"]').fill('test');
  await page.locator('input[type="password"]').fill('test');
  await page.getByRole('button', { name: /^로그인$/ }).click();

  await expect(page).toHaveURL(/\/attendance/, { timeout: 10_000 });
});

test('잘못된 자격증명은 에러 표시', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('test');
  await page.locator('input[type="password"]').fill('wrong-password');
  await page.getByRole('button', { name: /^로그인$/ }).click();

  await expect(page.getByText(/아이디 또는 비밀번호가 올바르지 않습니다/)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});
