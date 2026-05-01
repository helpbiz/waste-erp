/**
 * 회사별 기능 권한 게이트 — 페이지/서버 액션 진입 차단 helper.
 *
 * 사용 예 (server component):
 *   await requireFeature(session, 'recommendedRoute', '/worker');
 *   ↓
 *   해당 contractor 의 기능 OFF 면 redirect 하거나 안내 페이지로 이동
 */
import { redirect } from 'next/navigation';
import { hasFeature, type FeatureKey } from './features';
import type { SessionPayload } from './auth';

/**
 * 기능 활성 여부 확인 — false 면 fallbackPath 로 redirect.
 *
 * @param session  현재 사용자 세션 (contractorId 필수, 없으면 통과)
 * @param feature  카탈로그 키
 * @param fallbackPath  기능 OFF 시 이동할 경로 (default: /feature-disabled?key=...)
 */
export async function requireFeature(
  session: SessionPayload | null,
  feature: FeatureKey,
  fallbackPath?: string,
): Promise<void> {
  if (!session) return;
  /* contractor 가 없는 사용자(SUPER/MUNI) 는 게이트 미적용 — 모든 회사 기능을 모니터링·관리 */
  if (!session.contractorId) return;

  const ok = await hasFeature(session.contractorId, feature);
  if (!ok) {
    const path = fallbackPath ?? `/feature-disabled?feature=${encodeURIComponent(feature)}`;
    redirect(path);
  }
}
