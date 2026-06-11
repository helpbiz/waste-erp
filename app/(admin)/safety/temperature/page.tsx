import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';
import TemperatureClient from './_temperature-client';

export const dynamic = 'force-dynamic';

export default async function TemperaturePage({
  searchParams,
}: {
  searchParams: { yearMonth?: string };
}) {
  const session = await readSession();
  if (!session) redirect('/login');
  const isManager = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role);
  if (!isManager) redirect('/safety');

  const thisMonth = todayKstDate().toISOString().slice(0, 7);
  const yearMonth = searchParams.yearMonth ?? thisMonth;

  return <TemperatureClient initialYearMonth={yearMonth} />;
}
