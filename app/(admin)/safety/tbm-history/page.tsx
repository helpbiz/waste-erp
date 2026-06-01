import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import TbmHistoryClient from './_tbm-history-client';

export const dynamic = 'force-dynamic';

export default async function TbmHistoryPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const isManager = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(session.role);
  if (!isManager) redirect('/safety');
  return <TbmHistoryClient />;
}
