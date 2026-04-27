/**
 * POST /api/auth/consent — 개인정보 수집·이용 동의 등록
 *
 * - 동의 시각을 user.privacyConsentAt에 저장
 * - JWT를 새 consentedAt으로 재발급 (미들웨어 통과용)
 * - 감사로그 기록
 *
 * 미동의(거부) 시: 클라이언트는 별도 로그아웃 호출을 거쳐 /login 으로 이동
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession, issueSession, CURRENT_PRIVACY_VERSION } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  agree: z.literal(true),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'agreement_required' }, { status: 400 });
  }

  const now = new Date();

  await prisma.user.update({
    where: { id: BigInt(session.userId) },
    data: {
      privacyConsentAt: now,
      privacyConsentVersion: CURRENT_PRIVACY_VERSION,
    },
  });

  /* JWT 재발급 — 미들웨어가 consentedAt를 즉시 인식하도록 */
  await issueSession({
    userId: session.userId,
    role: session.role,
    contractorId: session.contractorId,
    municipalityId: session.municipalityId,
    name: session.name,
    consentedAt: now.toISOString(),
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'PRIVACY_CONSENT',
      resourceType: 'user',
      resourceId: session.userId,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      metadata: { version: CURRENT_PRIVACY_VERSION } as object,
    },
  });

  return NextResponse.json({ ok: true, consentedAt: now.toISOString() });
}
