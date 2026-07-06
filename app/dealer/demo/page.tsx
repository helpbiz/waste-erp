import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import DemoClient from './_demo-client';

export const dynamic = 'force-dynamic';

export default async function DealerDemoPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'DEALER') redirect('/dashboard');

  return <DemoClient />;
}
