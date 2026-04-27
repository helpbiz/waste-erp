import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import SuperAdminClient from './_super-admin-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminPage() {
  const session = (await readSession())!;
  if (session.role !== 'SUPER_ADMIN') redirect('/dashboard');
  return <SuperAdminClient />;
}
