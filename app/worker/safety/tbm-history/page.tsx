import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TbmHistoryWorkerClient from './_tbm-history-worker-client';

export const dynamic = 'force-dynamic';

export default async function WorkerTbmHistoryPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  return <TbmHistoryWorkerClient />;
}
