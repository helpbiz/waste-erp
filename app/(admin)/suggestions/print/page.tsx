import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import SuggestionsPrintClient from './_print-client';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export default async function SuggestionsPrintPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; autoprint?: string };
}) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!ADMIN_ROLES.has(session.role)) redirect('/');

  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.from ?? '') ? searchParams!.from! : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.to ?? '') ? searchParams!.to! : defaultTo;
  const autoprint = searchParams?.autoprint === '1';

  return <SuggestionsPrintClient from={from} to={to} autoprint={autoprint} />;
}
