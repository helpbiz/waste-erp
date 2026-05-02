import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import SuggestionsAdminClient from './_suggestions-admin-client';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export default async function SuggestionsAdminPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.has(session.role)) redirect('/');

  const canMutate = session.role !== 'MUNI_ADMIN';
  return <SuggestionsAdminClient canMutate={canMutate} role={session.role} />;
}
