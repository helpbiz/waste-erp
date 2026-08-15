import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import MuniUsersClient from './_muni-users-client';

export const dynamic = 'force-dynamic';

export default async function MuniUsersPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'MUNI_ADMIN') redirect('/dashboard');

  return <MuniUsersClient />;
}
