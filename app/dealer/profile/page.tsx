import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import AdminProfileClient from '@/app/(admin)/profile/_profile-client';

export const dynamic = 'force-dynamic';

export default async function DealerProfilePage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'DEALER') redirect('/dashboard');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-bold">🔑 내 계정</h1>
      <AdminProfileClient name={session.name} role={session.role} />
    </div>
  );
}
