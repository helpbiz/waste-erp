import { timingSafeEqual } from 'crypto';

/** P3-4: 타이밍 공격 방지 — 단순 문자열 비교 대신 crypto.timingSafeEqual 사용 */
export function isCronAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get('authorization');
  if (!provided) return false;
  const expectedFull = `Bearer ${expected}`;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expectedFull);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
