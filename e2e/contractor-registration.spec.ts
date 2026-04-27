// Plan SC-1: POST /api/contractors 정상 동작 + duplicate businessNo 차단 + 권한 체크
import { test, expect, type APIRequestContext } from '@playwright/test';

const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

async function makeSuperContext(
  playwright: { request: { newContext: (opts: { baseURL: string }) => Promise<APIRequestContext> } },
  baseURL: string,
): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { username: 'super', password: SEED_PWD },
  });
  if (!res.ok()) throw new Error(`super login failed: ${res.status()}`);
  return ctx;
}

test('POST /api/contractors — 권한 없는 사용자(test)는 403', async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL: baseURL! });
  await ctx.post('/api/auth/login', { data: { username: 'test', password: 'test' } });
  const res = await ctx.post('/api/contractors', {
    data: {
      municipalityId: '1',
      companyName: 'Forbidden Test',
      businessNo: '999-99-99999',
    },
  });
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test('POST /api/contractors — invalid_request (필수 필드 누락) 400', async ({ playwright, baseURL }) => {
  const ctx = await makeSuperContext(playwright, baseURL!);
  const res = await ctx.post('/api/contractors', {
    data: { companyName: 'No Muni' },
  });
  expect(res.status()).toBe(400);
  const j = await res.json();
  expect(j.error).toBe('invalid_request');
  await ctx.dispose();
});

test('POST /api/contractors — duplicate businessNo 차단', async ({ playwright, baseURL }) => {
  const ctx = await makeSuperContext(playwright, baseURL!);
  /* seed의 (주)한국청소서비스 사업자번호 = 123-45-67890 — 중복으로 차단되어야 함 */
  const muniRes = await ctx.get('/api/super-admin/municipalities?limit=1');
  const muniJson = await muniRes.json();
  const muniId = muniJson.items[0]?.id;
  if (!muniId) test.skip(true, 'no municipality');

  const res = await ctx.post('/api/contractors', {
    data: {
      municipalityId: muniId,
      companyName: 'Dup Test',
      businessNo: '123-45-67890', // seed에 이미 존재
    },
  });
  expect(res.status()).toBe(400);
  const j = await res.json();
  expect(j.error).toBe('duplicate_business_no');
  await ctx.dispose();
});

test('POST /api/contractors — 정상 등록 + GET 응답에 포함', async ({ playwright, baseURL }) => {
  const ctx = await makeSuperContext(playwright, baseURL!);
  const muniRes = await ctx.get('/api/super-admin/municipalities?limit=1');
  const muniId = (await muniRes.json()).items[0]?.id;
  if (!muniId) test.skip(true, 'no municipality');

  /* 사업자번호 동적 생성 — 중복 회피 */
  const businessNo = `TST-${Date.now().toString().slice(-7)}`;
  const post = await ctx.post('/api/contractors', {
    data: {
      municipalityId: muniId,
      companyName: 'E2E Test 위탁업체',
      businessNo,
      status: 'SETUP',
      ceoName: '홍길동',
    },
  });
  expect(post.ok(), `status=${post.status()}`).toBeTruthy();
  const created = await post.json();
  expect(created.ok).toBe(true);
  expect(created.id).toBeTruthy();

  /* GET 으로 새로 등록한 contractor 조회 */
  const list = await ctx.get('/api/contractors');
  const j = await list.json();
  const found = j.items.find((c: { id: string }) => c.id === created.id);
  expect(found).toBeTruthy();
  expect(found.companyName).toBe('E2E Test 위탁업체');
  expect(found.businessNo).toBe(businessNo);

  await ctx.dispose();
});
