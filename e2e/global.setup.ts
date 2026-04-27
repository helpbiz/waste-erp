import { test as setup, expect } from '@playwright/test';

const STATE_PATH = 'e2e/.auth/state.json';
const SUPER_STATE_PATH = 'e2e/.auth/super-state.json';
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

setup('authenticate users (test + super)', async ({ playwright, baseURL }) => {
  /* test 사용자 — 일반 admin (INTERNAL_ADMIN) */
  const testCtx = await playwright.request.newContext({ baseURL });
  const testRes = await testCtx.post('/api/auth/login', {
    data: { username: 'test', password: 'test' },
  });
  expect(testRes.ok(), 'test login should succeed').toBeTruthy();
  await testCtx.storageState({ path: STATE_PATH });
  await testCtx.dispose();

  /* super 사용자 — SUPER_ADMIN (별도 storage state) */
  const superCtx = await playwright.request.newContext({ baseURL });
  const superRes = await superCtx.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  expect(superRes.ok(), 'super login should succeed').toBeTruthy();
  await superCtx.storageState({ path: SUPER_STATE_PATH });
  await superCtx.dispose();
});
