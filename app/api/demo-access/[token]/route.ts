/**
 * GET /api/demo-access/:token — 예비고객이 딜러 개입 없이 바로 접속하는 데모 매직링크.
 *
 * 인증 없이(비로그인 상태) 호출 가능한 공개 엔드포인트(middleware.ts PUBLIC_PATHS 등록 필요).
 * 토큰이 유효(isDemo=true + 만료 전)하면 그 데모의 관리자 계정으로 즉시 세션을 발급하고
 * 대시보드로 리다이렉트한다 — 비밀번호 입력 절차 없음. 토큰은 Contractor(단독 회사 데모,
 * CONTRACTOR_ADMIN) 또는 Municipality(지자체 모드 그룹 데모, MUNI_ADMIN) 둘 중 하나에 매칭된다.
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

/**
 * nginx가 내부 컨테이너 바인딩 주소(0.0.0.0:3000 등)가 아니라 실제 공개 도메인으로
 * 리다이렉트하도록, req.url 대신 프록시가 전달하는 헤더로 origin을 재구성한다.
 * (2026-07-06 실제 프로덕션에서 발견 — req.url 그대로 쓰면 내부 주소로 리다이렉트되어
 * 예비고객 브라우저가 접속 불가능한 사고가 있었음)
 */
function resolvePublicOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const origin = resolvePublicOrigin(req);
  const resolved = await resolveDemoAccessToken(params.token);
  if (!resolved) {
    return NextResponse.redirect(new URL('/login?error=demo_link_invalid', origin));
  }
  const { adminUser } = resolved;

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

  /* 2026-07-08 — 지자체 모드 그룹 데모(municipality)와 단독 회사 데모(contractor)를 구분해 감사 */
  const resourceType = resolved.kind === 'municipality' ? 'municipality' : 'contractor';
  const resourceId = resolved.kind === 'municipality' ? resolved.municipality.id.toString() : resolved.contractor.id.toString();

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      actorRole: adminUser.role,
      action: 'DEMO_LINK_ACCESS',
      resourceType,
      resourceId,
      contractorId: resolved.kind === 'contractor' ? resolved.contractor.id : null,
      municipalityId: resolved.kind === 'municipality' ? resolved.municipality.id : null,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
  }).catch(() => null);

  return NextResponse.redirect(new URL('/dashboard', origin));
}
