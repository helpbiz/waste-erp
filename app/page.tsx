import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';

export default async function Root() {
  const session = await readSession();
  if (!session) redirect('/login');
  redirect(session.role === 'WORKER' ? '/worker' : '/dashboard');
}
