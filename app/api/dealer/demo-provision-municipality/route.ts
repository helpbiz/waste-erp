/**
 * POST /api/dealer/demo-provision-municipality — 지자체 모드 그룹 데모 셀프발급.
 *
 * 권한: DEALER 전용. 반환된 계정 role은 반드시 MUNI_ADMIN — SUPER_ADMIN 아님.
 * 가상 지자체 1개 + 가상 위탁업체 3개를 함께 만들어 MUNI_ADMIN 통합관제 대시보드를 시연한다.
 * 2026-07-08 에이전트팀(아키텍처/보안/DB안정성) 조건부 승인 후 추가.
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { provisionMunicipalityDemo, DemoQuotaExceededError } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const result = await provisionMunicipalityDemo(BigInt(session.userId));

    await writeAudit(req, session, {
      action: 'DEMO_MUNICIPALITY_PROVISION',
      resourceType: 'municipality',
      resourceId: result.municipalityId.toString(),
      municipalityId: result.municipalityId,
      metadata: { isDemo: true, expiresAt: result.expiresAt, contractorCount: result.contractorIds.length },
    });

    return NextResponse.json(
      {
        municipalityId: result.municipalityId.toString(),
        contractorIds: result.contractorIds.map((id) => id.toString()),
        adminUsername: result.adminUsername,
        adminPassword: result.generatedPassword,
        expiresAt: result.expiresAt,
        accessToken: result.demoAccessToken,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof DemoQuotaExceededError) {
      return NextResponse.json({ error: 'demo_quota_exceeded' }, { status: 409 });
    }
    throw e;
  }
}
