import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import AlertHistoryClient from './_alert-history-client';

export const dynamic = 'force-dynamic';

export default async function AlertHistoryPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const isManager = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role);
  if (!isManager) redirect('/safety');
  return <AlertHistoryClient />;
}
