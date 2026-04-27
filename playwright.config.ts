// Design Ref: §11 — playwright.config.ts toHaveScreenshot 옵션 + retry 정책
import { defineConfig, devices } from '@playwright/test';

const STORAGE = 'e2e/.auth/state.json';

const baseChromium = {
  ...devices['Desktop Chrome'],
  storageState: STORAGE,
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Design Ref: §10.1 — flaky retry 정책: CI에서만 1회 허용
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  // Design Ref: §1.1 — Visual diff threshold으로 폰트 안티앨리어싱 등 흡수
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,           // per-pixel color tolerance
      maxDiffPixelRatio: 0.01,  // <= 1% 픽셀 변화는 통과
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },

    {
      name: '375-iPhone-SE',
      use: {
        ...baseChromium,
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
    {
      name: '393-Pixel7',
      use: {
        ...baseChromium,
        viewport: { width: 393, height: 851 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
    {
      name: '360-GalaxyS',
      use: {
        ...baseChromium,
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 4,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
    {
      name: '768-iPad',
      use: {
        ...baseChromium,
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
  ],
});
