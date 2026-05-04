/**
 * 회사 admin 자율 셋팅 페이지 — 관제 모드 (풀스크린) 화면 커스터마이즈.
 *
 * 권한:
 *  - SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN: 가능
 *  - WORKER, MUNI_ADMIN: 차단
 *  - 자기 회사 nocAccess 활성화 시만 (SUPER_ADMIN 제외)
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import WallSettingsClient from './_settings-client';

export const dynamic = 'force-dynamic';

export default async function WallSettingsPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/wall/settings');

  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role)) {
    redirect('/dashboard?reason=noc_settings_forbidden');
  }

  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId) redirect('/dashboard');
    const enabled = await hasFeature(session.contractorId, 'nocAccess');
    if (!enabled) redirect('/dashboard?reason=noc_disabled');
  }

  return <WallSettingsClient sessionRole={session.role} />;
}
