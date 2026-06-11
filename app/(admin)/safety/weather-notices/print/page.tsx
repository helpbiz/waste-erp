import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';
import WeatherPrintClient from './_print-client';

export const dynamic = 'force-dynamic';

function todayStr() {
  return todayKstDate().toISOString().slice(0, 10);
}

function monthStartStr() {
  const t = todayKstDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export default async function WeatherNoticesPrintPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; autoprint?: string; noPhoto?: string };
}) {
  const session = await readSession();
  if (!session) redirect('/login');

  const from      = searchParams.from ?? monthStartStr();
  const to        = searchParams.to   ?? todayStr();
  const autoprint = searchParams.autoprint === '1';

  return (
    <WeatherPrintClient
      from={from}
      to={to}
      autoprint={autoprint}
    />
  );
}
