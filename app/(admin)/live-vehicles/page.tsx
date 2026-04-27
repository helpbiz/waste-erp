import { readSession } from '@/lib/auth';
import LiveVehiclesClient from './_live-vehicles-client';

export const dynamic = 'force-dynamic';

export default async function LiveVehiclesPage() {
  const session = (await readSession())!;
  return (
    <LiveVehiclesClient
      canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'}
      isSuperAdmin={session.role === 'SUPER_ADMIN'}
    />
  );
}
