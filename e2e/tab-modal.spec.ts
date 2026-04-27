// Design Ref: §8.3 — 탭/모달 클릭 후 가로 오버플로우 재검증
// Plan SC: FR-07
import { test, expect, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { docW, winW } = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }));
  expect(docW, `${label}: docW=${docW} > winW=${winW}`).toBeLessThanOrEqual(winW + 1);
}

test('users 휴가관리 탭 진입 후 가로 오버플로우 없음', async ({ page }, info) => {
  await page.goto('/users', { waitUntil: 'networkidle' });

  // 휴가관리 탭 (텍스트 "휴가" 포함 버튼) 클릭 시도. 없으면 skip.
  const tab = page.getByRole('button', { name: /휴가/ }).first();
  if (await tab.count() === 0) {
    test.skip(true, '휴가관리 탭 미발견 — skip');
    return;
  }
  await tab.click();
  await page.waitForLoadState('networkidle');
  await assertNoHorizontalOverflow(page, `[${info.project.name}] /users 휴가관리 탭`);
});

test('safety 날씨알림 폼 열기 후 가로 오버플로우 없음', async ({ page }, info) => {
  await page.goto('/safety', { waitUntil: 'networkidle' });

  // 날씨 알림 헤더 토글 (role=button, "기상악화" 텍스트로 매칭)
  const toggle = page.getByRole('button', { name: /기상악화/ }).first();
  if (await toggle.count() === 0) {
    test.skip(true, '기상악화 알림 토글 미발견 — 매니저 권한 부족 또는 페이지 변경');
    return;
  }
  await toggle.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await assertNoHorizontalOverflow(page, `[${info.project.name}] /safety 날씨알림 폼`);
});
