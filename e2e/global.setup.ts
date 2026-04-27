import { test as setup, expect } from '@playwright/test';

const STATE_PATH = 'e2e/.auth/state.json';
const SUPER_STATE_PATH = 'e2e/.auth/super-state.json';
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

setup('authenticate as test user', async ({ playwright, baseURL }) => {
  /* 명시적 isolated context — 다른 setup과 cookie/state 분리 */
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { username: 'test', password: 'test' },
  });
  expect(res.ok(), 'login should succeed').toBeTruthy();
  await ctx.storageState({ path: STATE_PATH });
  await ctx.dispose();
});

setup('authenticate as super user', async ({ playwright, baseURL }) => {
  /* SUPER_ADMIN 전용 isolated context */
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  expect(res.ok(), 'super login should succeed').toBeTruthy();
  await ctx.storageState({ path: SUPER_STATE_PATH });
  await ctx.dispose();
});
