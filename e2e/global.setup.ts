import { test as setup, expect } from '@playwright/test';

const STATE_PATH = 'e2e/.auth/state.json';

setup('authenticate as test user', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { username: 'test', password: 'test' },
  });
  expect(res.ok(), 'login should succeed').toBeTruthy();
  await request.storageState({ path: STATE_PATH });
});
