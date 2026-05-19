import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { requireFeature } from '@/lib/feature-guard';
import { prisma } from '@/lib/db';
import PayslipClient from './_payslip-client';

export const dynamic = 'force-dynamic';

export default async function WorkerPayslipPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard');

  await requireFeature(session, 'payslip', '/worker');

  const me = await prisma.user.findUnique({
    where:  { id: BigInt(session.userId) },
    select: { name: true },
  });

  return <PayslipClient workerName={me?.name ?? session.name} />;
}
