import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TbmPrintClient from './_tbm-print-client';

export const dynamic = 'force-dynamic';

export default async function TbmPrintPage({
  searchParams,
}: {
  searchParams?: { yearMonth?: string; facilityId?: string };
}) {
  const session = await readSession();
  if (!session) redirect('/login');

  const isManager = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role);
  if (!isManager) redirect('/safety');

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const defaultYM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const yearMonth = searchParams?.yearMonth ?? defaultYM;
  const facilityId = searchParams?.facilityId ?? '';

  return <TbmPrintClient yearMonth={yearMonth} facilityId={facilityId} />;
}
