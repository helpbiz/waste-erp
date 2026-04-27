// Design Ref: §8.4 — Visual regression: 9 페이지 × 4 디바이스 = 36 toHaveScreenshot
// Plan SC: FR-05 (시각 회귀 베이스라인 36개), FR-06 (diff artifact 업로드)
import { test, expect } from '@playwright/test';
import { ADMIN_PAGES } from './helpers/pages';

for (const path of ADMIN_PAGES) {
  test(`visual baseline ${path}`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // 동적 타임스탬프 등으로 인한 false positive 방지: 고정 마스크 영역
    const masked = page.locator('[data-testid="now-time"], time, .font-mono.text-slate-500');

    await expect(page).toHaveScreenshot(
      `${info.project.name}__${path.replace(/\//g, '_').replace(/^_/, '')}.png`,
      {
        fullPage: true,
        mask: await masked.count() > 0 ? [masked] : undefined,
      },
    );
  });
}
