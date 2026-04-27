import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, issueSession } from '@/lib/auth';

export const runtime = 'nodejs'; // bcrypt 사용

const Body = z.object({
  username: z.string().trim().min(2).max(50),
  password: z.string().min(1).max(128),
});

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
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

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
    data: { lastLogin: new Date() },
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

  /* Role 기반 랜딩 페이지 — WORKER는 모바일 워커앱, 그 외는 민원관리 */
  const redirectTo = user.role === 'WORKER' ? '/worker' : '/complaints';

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
