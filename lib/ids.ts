import { createHmac, timingSafeEqual } from 'crypto';

/** BigInt 변환 — 실패 시 null (SyntaxError 방지) */
export function parseId(v: unknown): bigint | null {
  if (v == null || v === '') return null;
  try { return BigInt(String(v)); } catch { return null; }
}

/**
 * 시민 민원 조회 토큰 — phone + 날짜(KST) HMAC, 하루 단위 유효
 */
export function makeLookupToken(phone: string): string {
  const day = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  return createHmac('sha256', secret).update(`${phone}:${day}`).digest('hex').slice(0, 32);
}

export function verifyLookupToken(phone: string, token: string): boolean {
  const expected = makeLookupToken(phone);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
