/**
 * 관제 모드 설정 페이지.
 *
 * 권한:
 *  - SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN: 자기 회사 설정 (nocAccess 필요)
 *  - MUNI_ADMIN: 지자체 관제 화면 설정 (MuniAccessPolicy.wallConfig 저장)
 *  - WORKER: 차단
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import WallSettingsClient from './_settings-client';

export const dynamic = 'force-dynamic';

export default async function WallSettingsPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/wall/settings');

  if (session.role === 'WORKER') redirect('/dashboard?reason=noc_settings_forbidden');

  /* 업체 관리자: nocAccess 활성 검증 */
  if (!['SUPER_ADMIN', 'MUNI_ADMIN'].includes(session.role)) {
    if (!session.contractorId) redirect('/dashboard');
    const enabled = await hasFeature(session.contractorId, 'nocAccess');
    if (!enabled) redirect('/dashboard?reason=noc_disabled');
  }

  return <WallSettingsClient sessionRole={session.role} />;
}
