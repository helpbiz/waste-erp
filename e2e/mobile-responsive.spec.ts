// Design Ref: §8.3 — 가로 오버플로우 검증 (회귀 차단의 첫 번째 기준선)
// Plan SC: FR-04
import { test, expect } from '@playwright/test';
import { ADMIN_PAGES } from './helpers/pages';

for (const path of ADMIN_PAGES) {
  test(`renders without horizontal overflow ${path}`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));

    const { docW, winW } = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
    }));

    expect(
      docW,
      `[${info.project.name}] ${path} body width ${docW}px exceeds viewport ${winW}px`,
    ).toBeLessThanOrEqual(winW + 1);
  });
}
