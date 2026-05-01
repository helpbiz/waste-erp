import { readSession } from '@/lib/auth';
import { requireFeature } from '@/lib/feature-guard';
import LiveVehiclesClient from './_live-vehicles-client';

export const dynamic = 'force-dynamic';

export default async function LiveVehiclesPage() {
  const session = (await readSession())!;
  /* 회사별 기능 권한 — vehicleTracking OFF 면 안내 페이지로 */
  await requireFeature(session, 'vehicleTracking');
  return (
    <LiveVehiclesClient
      canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'}
      isSuperAdmin={session.role === 'SUPER_ADMIN'}
    />
  );
}
