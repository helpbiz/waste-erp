/**
 * 회사·지자체 풀스크린 관제 모드 — 50" 모니터 / Chromium kiosk 용.
 *
 * 권한 (Agent Team 합의 2026-05-02):
 *  - SUPER_ADMIN: 항상 가능 (글로벌)
 *  - CONTRACTOR_ADMIN / INTERNAL_ADMIN: nocAccess feature 활성화 시
 *  - MUNI_ADMIN: 산하 contractor 검사 후 활성화 시 (Phase 2)
 *  - WORKER: 차단
 *
 * 데이터: 메인 대시보드(/dashboard) 와 동일한 KPI 6종 + 시설별 패널을
 *        다크 배경·큰 글씨·자동 풀스크린·30초 폴링으로 표시.
 *
 * Hot-fix 2026-05-02 — Agent Team 합의 + 사용자 의도 재확인 후 신규.
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import WallClient from './_wall-client';

export const dynamic = 'force-dynamic';

export default async function DashboardWallPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/wall');

  /* WORKER 항상 차단 */
  if (session.role === 'WORKER') redirect('/');

  /* SUPER_ADMIN 외에는 nocAccess 검증 */
  if (session.role !== 'SUPER_ADMIN') {
    if (session.contractorId) {
      const enabled = await hasFeature(session.contractorId, 'nocAccess');
      if (!enabled) redirect('/dashboard?reason=noc_disabled');
    } else {
      /* MUNI_ADMIN — Phase 2 산하 검사 예정 */
      redirect('/dashboard?reason=noc_phase2_pending');
    }
  }

  return (
    <WallClient
      session={{
        name: session.name,
        role: session.role,
        contractorId: session.contractorId ?? null,
      }}
    />
  );
}
