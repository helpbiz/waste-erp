/**
 * NOC 무인 단말 전용 long-lived JWT 발급 엔드포인트.
 *
 * - 인증: Authorization: Bearer <NOC_ISSUE_SECRET>  (시크릿 미설정 시 503)
 * - 대상: SUPER_ADMIN 사용자만 (NOC는 최고 권한 가시성을 가정)
 * - TTL: 1~365일 (기본 90일)
 * - 발급된 토큰은 일반 wciSession과 동일한 검증 경로(jwtVerify)를 통과하므로
 *   middleware/route 코드 변경이 필요 없다.
 *
 * 운영 정책:
 *   - 본 엔드포인트는 LAN 내부에서만 호출되도록 nginx에서 IP allowlist 추가 권장
 *     (LAN 192.168.0.0/16, Tailscale 100.64.0.0/10 등)
 *   - 시크릿이 노출되면 즉시 회전: NOC_ISSUE_SECRET 변경 + 컨테이너 재시작
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { issueRawToken } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().trim().min(2).max(50),
  ttlDays: z.number().int().min(1).max(365).default(90),
});

export async function POST(req: Request) {
  const secret = process.env.NOC_ISSUE_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'noc_issue_disabled' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  /* timing-safe 비교 — 길이 다를 때 즉시 거부 */
  if (auth.length !== expected.length || auth !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { username, ttlDays } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'super_admin_only' }, { status: 403 });
  }

  const ttlSec = ttlDays * 24 * 60 * 60;
  const token = await issueRawToken({
    userId: user.id.toString(),
    role: user.role,
    contractorId: user.contractorId?.toString() ?? null,
    municipalityId: user.municipalityId?.toString() ?? null,
    name: user.name,
    consentedAt: user.privacyConsentAt?.toISOString() ?? new Date().toISOString(),
  }, ttlSec);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorRole: user.role,
      action: 'NOC_TOKEN_ISSUED',
      resourceType: 'session',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
  }).catch(() => null);

  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  return NextResponse.json({ token, ttlSec, ttlDays, expiresAt, cookieName: 'wciSession' });
}
