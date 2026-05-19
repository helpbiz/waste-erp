import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager } from '@/lib/vehicle-logs';
import LogsOverviewClient from './_logs-overview-client';

export const dynamic = 'force-dynamic';

export default async function LogsOverviewPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!isVehicleLogManager(session.role)) redirect('/vehicles');
  return <LogsOverviewClient />;
}
