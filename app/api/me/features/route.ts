/**
 * /api/me/features — 현재 사용자 contractor 의 기능 활성 상태.
 *
 * 클라이언트 사이드 게이트 (sidebar 메뉴 자체 숨김 등) 에 사용.
 * SUPER_ADMIN / MUNI_ADMIN (contractor 없음) 은 모든 기능 ON 으로 응답 → 모니터링 권한 보존.
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { FEATURE_CATALOG, listContractorFeatures, type FeatureKey } from '@/lib/features';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  /* SUPER/MUNI 등 contractor 가 없는 사용자 — 전체 ON 으로 응답 (게이트 미적용) */
  if (!session.contractorId) {
    const all: Record<string, boolean> = {};
    for (const meta of FEATURE_CATALOG) all[meta.key] = true;
    return NextResponse.json({
      contractorId: null,
      features: all,
    });
  }

  const features = await listContractorFeatures(session.contractorId);
  const map: Record<string, boolean> = {};
  for (const f of features) map[f.key] = f.enabled;

  return NextResponse.json({
    contractorId: session.contractorId,
    features: map as Record<FeatureKey, boolean>,
  });
}
