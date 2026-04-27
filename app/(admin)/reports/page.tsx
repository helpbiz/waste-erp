import { readSession } from '@/lib/auth';
import ReportsClient from './_reports-client';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = (await readSession())!;
  return <ReportsClient session={{ role: session.role, name: session.name }} />;
}
