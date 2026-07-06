import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import LeadsClient from './_leads-client';

export const dynamic = 'force-dynamic';

export default async function DealerLeadsPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'DEALER') redirect('/dashboard');

  return <LeadsClient />;
}
