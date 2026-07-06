/**
 * POST /api/dealer/demo-provision — 데모 셀프발급 (SUPER_ADMIN 승인 게이트 없음)
 *
 * 권한: DEALER 전용. 반환된 계정 role은 반드시 CONTRACTOR_ADMIN — SUPER_ADMIN 아님.
 * Design §4.1/§4.2/§7 Security Considerations.
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { provisionDemo, DemoQuotaExceededError } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const result = await provisionDemo(BigInt(session.userId));

    await writeAudit(req, session, {
      action: 'DEMO_PROVISION',
      resourceType: 'contractor',
      resourceId: result.contractorId.toString(),
      contractorId: result.contractorId,
      municipalityId: result.municipalityId,
      metadata: { isDemo: true, expiresAt: result.expiresAt },
    });

    return NextResponse.json(
      {
        contractorId: result.contractorId.toString(),
        municipalityId: result.municipalityId.toString(),
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
