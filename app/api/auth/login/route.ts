import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, issueSession } from '@/lib/auth';

export const runtime = 'nodejs'; // bcrypt 사용

const Body = z.object({
  username: z.string().trim().min(2).max(50),
  password: z.string().min(1).max(128),
});

/* #9 계정 잠금 정책 — 브루트포스 방어 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10분

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.status !== 'ACTIVE') {
    /* 동일 메시지로 사용자 존재 여부 노출 방지 */
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  /* 잠금 상태 확인 — 만료 시 자동 해제 */
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const remainingSec = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
    return NextResponse.json(
      { error: 'account_locked', remainingSec, lockedUntil: user.lockedUntil.toISOString() },
      { status: 423 }
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    /* 실패 카운트 증가 — 만료된 lockedUntil은 이번 요청에서 무시되었으므로 0부터 다시 셈
       (직전 try가 잠금 해제 시점 이후라 새 카운트 시작이 자연스러움) */
    const wasExpiredLock = user.lockedUntil && user.lockedUntil <= now;
    const baseAttempts = wasExpiredLock ? 0 : user.failedLoginAttempts;
    const nextAttempts = baseAttempts + 1;
    const willLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = willLock ? new Date(now.getTime() + LOCK_DURATION_MS) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: willLock ? 0 : nextAttempts,  // 잠금 시 카운트 리셋, 잠금 해제 후 새 카운트
        lockedUntil,
      },
    });

    /* 감사 로그 — 실패/잠금 모두 기록 */
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        action: willLock ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
    }).catch(() => null);

    if (willLock) {
      return NextResponse.json(
        {
          error: 'account_locked',
          remainingSec: Math.ceil(LOCK_DURATION_MS / 1000),
          lockedUntil: lockedUntil!.toISOString(),
        },
        { status: 423 }
      );
    }

    /* 남은 시도 횟수 노출 — 사용자 안내 */
    const remainingAttempts = MAX_FAILED_ATTEMPTS - nextAttempts;
    return NextResponse.json(
      { error: 'invalid_credentials', remainingAttempts },
      { status: 401 }
    );
  }

  /* 성공 — 카운트 + 잠금 모두 리셋 */
  await issueSession({
    userId: user.id.toString(),
    role: user.role,
    contractorId: user.contractorId?.toString() ?? null,
    municipalityId: user.municipalityId?.toString() ?? null,
    name: user.name,
    consentedAt: user.privacyConsentAt?.toISOString() ?? null,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      resourceType: 'session',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
  });

  /* Role 기반 랜딩 페이지.
     사용자 요청 2026-05-01: WORKER → /worker, 그 외 admin 모두 → /dashboard (메인 대시보드).
     기존엔 /complaints (민원관리) 였으나 첫 화면은 종합 KPI dashboard 가 자연스럽다는 결정. */
  const redirectTo = user.role === 'WORKER' ? '/worker' : '/dashboard';

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id.toString(),
      username: user.username,
      name: user.name,
      role: user.role,
      contractorId: user.contractorId?.toString() ?? null,
      municipalityId: user.municipalityId?.toString() ?? null,
    },
    /* 동의 미진행 사용자는 /consent로 이동 */
    needsConsent: !user.privacyConsentAt,
    redirectTo,
  });
}
