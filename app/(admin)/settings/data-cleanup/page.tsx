import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DataCleanupClient from './_data-cleanup-client';

export const dynamic = 'force-dynamic';

export default async function DataCleanupPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const isAdmin = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role);
  if (!isAdmin) redirect('/');
  return <DataCleanupClient />;
}
