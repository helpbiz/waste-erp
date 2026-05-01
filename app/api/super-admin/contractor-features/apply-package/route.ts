/**
 * 슈퍼관리자 — 회사에 요금제 패키지 일괄 적용.
 *
 * POST /api/super-admin/contractor-features/apply-package
 *   body: { contractorId, packageKey: 'TRIAL'|'BASIC'|'STANDARD'|'PRO' }
 *
 * 동작:
 *   1) 패키지에 정의된 8개 feature 모두 upsert (true/false 명시)
 *   2) 단일 audit log (CONTRACTOR_PACKAGE_APPLY) — feature 별 row 가 아닌 1건 요약
 *
 * 적용 후 contractor 의 기능 상태는 패키지 정의와 정확히 일치 → detectPackage() 가 그 패키지 반환.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { setContractorFeature, type FeatureKey } from '@/lib/features';
import { getPackage, type PackageKey } from '@/lib/feature-packages';

export const runtime = 'nodejs';

const Body = z.object({
  contractorId: z.union([z.string(), z.number()]),
  packageKey: z.enum(['TRIAL', 'BASIC', 'STANDARD', 'PRO']),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const pkg = getPackage(b.packageKey as PackageKey);
  if (!pkg) {
    return NextResponse.json({ error: 'unknown_package', key: b.packageKey }, { status: 400 });
  }

  const c = await prisma.contractor.findUnique({
    where: { id: BigInt(b.contractorId) },
    select: { id: true, companyName: true, deletedAt: true },
  });
  if (!c || c.deletedAt) {
    return NextResponse.json({ error: 'contractor_not_found' }, { status: 404 });
  }

  /* 8개 feature 모두 upsert — 순차 처리 (Promise.all 도 가능하지만 audit 일관성 위해 순차) */
  const featureKeys = Object.keys(pkg.features) as FeatureKey[];
  for (const key of featureKeys) {
    await setContractorFeature({
      contractorId: c.id,
      featureKey: key,
      enabled: pkg.features[key],
      updatedBy: session.userId,
    });
  }

  /* 단일 audit — 패키지 적용 1건으로 요약 (feature 별 8건이 아닌) */
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_PACKAGE_APPLY',
      resourceType: 'contractor',
      resourceId: c.id.toString(),
      contractorId: c.id,
      metadata: {
        packageKey: pkg.key,
        packageLabel: pkg.label,
        companyName: c.companyName,
        features: pkg.features,
      },
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    contractorId: b.contractorId,
    packageKey: pkg.key,
    appliedFeatures: pkg.features,
  });
}
