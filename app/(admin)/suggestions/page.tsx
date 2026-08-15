import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { canManageOperations } from '@/lib/rbac';
import SuggestionsAdminClient from './_suggestions-admin-client';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MUNI_ADMIN', 'MUNI_USER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export default async function SuggestionsAdminPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.has(session.role)) redirect('/');

  const canMutate = canManageOperations(session.role);
  return <SuggestionsAdminClient canMutate={canMutate} role={session.role} />;
}
