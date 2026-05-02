/**
 * 인증 유틸 — bcrypt + JWT(jose)
 * 쿠키: httpOnly + sameSite=strict + secure(prod)
 * Plan §5 / security-architect 권고 부합
 */
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Role } from '@prisma/client';

export const SESSION_COOKIE = 'wciSession';
const SESSION_TTL_SEC = 60 * 60 * 8; // 8h

/* deploy-readiness P0-1: fallback 제거. dev 환경 빠른 시작 시에는 32자 이상 dev secret 명시 강제 */
const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET || RAW_SECRET.length < 32) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았거나 32자 미만입니다. .env 또는 운영 env 에 설정 필요.');
}
const SECRET = new TextEncoder().encode(RAW_SECRET);

export type SessionPayload = {
  userId: string;
  role: Role;
  contractorId: string | null;
  municipalityId: string | null;
  name: string;
  /* 개인정보 수집·이용 동의 — null이면 /consent 강제 이동 */
  consentedAt: string | null;
};

export const CURRENT_PRIVACY_VERSION = 'v1.0-2026-04';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function issueSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(SECRET);

  /* secure flag — prod 기본값 true. E2E/CI 에서 http localhost로 테스트 시 COOKIE_SECURE=false 로 우회 */
  const secure = process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production';
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  return token;
}

/**
 * 쿠키 미세팅·임의 TTL JWT 발급 (NOC 무인 단말 등 long-lived 토큰 전용).
 * 발급 호출자(노출된 시크릿 보유자)가 토큰을 받아 적절히 보관·주입.
 */
export async function issueRawToken(payload: SessionPayload, ttlSec: number): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(SECRET);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
