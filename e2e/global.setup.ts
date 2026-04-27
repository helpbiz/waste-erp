import { test as setup, expect } from '@playwright/test';

const STATE_PATH = 'e2e/.auth/state.json';
const SUPER_STATE_PATH = 'e2e/.auth/super-state.json';
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

setup('authenticate as test user', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { username: 'test', password: 'test' },
  });
  expect(res.ok(), 'login should succeed').toBeTruthy();
  await request.storageState({ path: STATE_PATH });
});

setup('authenticate as super user', async ({ request }) => {
  /* SUPER_ADMIN 전용 테스트용 별도 storage state */
  const res = await request.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  expect(res.ok(), 'super login should succeed').toBeTruthy();
  await request.storageState({ path: SUPER_STATE_PATH });
});
