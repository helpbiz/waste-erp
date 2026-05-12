import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { redirect } from 'next/navigation';
import ApprovalsClient from './_approvals-client';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const session = (await readSession())!;
  if (!canManageUsers(session.role)) redirect('/');

  return <ApprovalsClient role={session.role} />;
}
