/**
 * 회사별 기능 권한 — 슈퍼관리자 전용.
 *
 * GET   /api/super-admin/contractor-features?contractorId=N
 *   → 해당 회사의 전체 기능 상태 (DB row 없으면 카탈로그 default).
 *
 * GET   /api/super-admin/contractor-features (no param)
 *   → 모든 회사의 활성 기능 요약 (matrix 표시용).
 *
 * PATCH /api/super-admin/contractor-features
 *   body: { contractorId, featureKey, enabled } → upsert.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  FEATURE_CATALOG,
  type FeatureKey,
  getFeatureMeta,
  listContractorFeatures,
  setContractorFeature,
} from '@/lib/features';

export const runtime = 'nodejs';

async function requireSuper() {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (session.role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: Request) {
  const guard = await requireSuper();
  if ('error' in guard) return guard.error;

  const url = new URL(req.url);
  const contractorIdParam = url.searchParams.get('contractorId');

  if (contractorIdParam) {
    const features = await listContractorFeatures(contractorIdParam);
    return NextResponse.json({
      contractorId: contractorIdParam,
      features,
      catalog: FEATURE_CATALOG,
    });
  }

  /* 전체 회사 목록 + 활성 기능 카운트 */
  const contractors = await prisma.contractor.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      municipality: { select: { id: true, name: true } },
      features: { select: { featureKey: true, enabled: true } },
    },
    orderBy: { companyName: 'asc' },
  });

  return NextResponse.json({
    catalog: FEATURE_CATALOG,
    contractors: contractors.map((c) => {
      const overrides = new Map(c.features.map((f) => [f.featureKey, f.enabled]));
      const enabledCount = FEATURE_CATALOG.filter((meta) => {
        const v = overrides.get(meta.key);
        return v === undefined ? meta.defaultEnabled : v;
      }).length;
      return {
        id: c.id.toString(),
        companyName: c.companyName,
        municipalityName: c.municipality?.name ?? null,
        enabledCount,
        totalCount: FEATURE_CATALOG.length,
        customCount: c.features.length, /* 명시 override row 수 */
      };
    }),
  });
}

const PatchBody = z.object({
  contractorId: z.union([z.string(), z.number()]),
  featureKey: z.string().min(1).max(50),
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const guard = await requireSuper();
  if ('error' in guard) return guard.error;
  const session = guard.session;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  if (!getFeatureMeta(b.featureKey)) {
    return NextResponse.json({ error: 'unknown_feature_key', key: b.featureKey }, { status: 400 });
  }

  /* contractor 존재 확인 */
  const c = await prisma.contractor.findUnique({
    where: { id: BigInt(b.contractorId) },
    select: { id: true, companyName: true, deletedAt: true },
  });
  if (!c || c.deletedAt) {
    return NextResponse.json({ error: 'contractor_not_found' }, { status: 404 });
  }

  await setContractorFeature({
    contractorId: c.id,
    featureKey: b.featureKey as FeatureKey,
    enabled: b.enabled,
    updatedBy: session.userId,
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_FEATURE_TOGGLE',
      resourceType: 'contractor_feature',
      resourceId: `${c.id}:${b.featureKey}`,
      contractorId: c.id,
      metadata: { featureKey: b.featureKey, enabled: b.enabled, companyName: c.companyName },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, contractorId: b.contractorId, featureKey: b.featureKey, enabled: b.enabled });
}
