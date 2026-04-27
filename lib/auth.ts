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

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-me-please-32-bytes-minimum-required'
);

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

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  return token;
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
