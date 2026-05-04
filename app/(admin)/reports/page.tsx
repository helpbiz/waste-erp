import { readSession } from '@/lib/auth';
import { isAvacContractor } from '@/lib/features';
import ReportsClient from './_reports-client';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = (await readSession())!;
  const isAvac = session.contractorId
    ? await isAvacContractor(BigInt(session.contractorId))
    : false;
  return <ReportsClient session={{ role: session.role, name: session.name }} isAvac={isAvac} />;
}
