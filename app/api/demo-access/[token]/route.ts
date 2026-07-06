/**
 * GET /api/demo-access/:token — 예비고객이 딜러 개입 없이 바로 접속하는 데모 매직링크.
 *
 * 인증 없이(비로그인 상태) 호출 가능한 공개 엔드포인트(middleware.ts PUBLIC_PATHS 등록 필요).
 * 토큰이 유효(isDemo=true Contractor에 매칭 + 만료 전)하면 그 데모의 CONTRACTOR_ADMIN 계정으로
 * 즉시 세션을 발급하고 대시보드로 리다이렉트한다 — 비밀번호 입력 절차 없음.
 *
 * 보안: 데모(isDemo=true) 전용. 실계정에는 이 메커니즘 자체가 존재하지 않음(토큰 컬럼이
 * isDemo=true일 때만 채워짐). 세션은 기존 데모 세션과 동일하게 isDemo 클레임 + 45분 TTL.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { issueSession } from '@/lib/auth';
import { DEMO_SESSION_TTL_SEC } from '@/lib/types/dealer';
import { resolveDemoAccessToken } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const resolved = await resolveDemoAccessToken(params.token);
  if (!resolved) {
    return NextResponse.redirect(new URL('/login?error=demo_link_invalid', req.url));
  }
  const { contractor, adminUser } = resolved;

  await issueSession(
    {
      userId: adminUser.id.toString(),
      role: adminUser.role,
      contractorId: adminUser.contractorId?.toString() ?? null,
      municipalityId: adminUser.municipalityId?.toString() ?? null,
      name: adminUser.name,
      consentedAt: adminUser.privacyConsentAt?.toISOString() ?? new Date().toISOString(),
      isDemo: true,
    },
    DEMO_SESSION_TTL_SEC,
  );

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      actorRole: adminUser.role,
      action: 'DEMO_LINK_ACCESS',
      resourceType: 'contractor',
      resourceId: contractor.id.toString(),
      contractorId: contractor.id,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
  }).catch(() => null);

  return NextResponse.redirect(new URL('/dashboard', req.url));
}
