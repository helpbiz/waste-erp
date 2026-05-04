import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import AdminProfileClient from './_profile-client';

export const dynamic = 'force-dynamic';

export default async function AdminProfilePage() {
  const session = await readSession();
  if (!session) redirect('/login');
  return <AdminProfileClient name={session.name} role={session.role} />;
}
