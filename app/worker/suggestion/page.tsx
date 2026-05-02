import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import SuggestionClient from './_suggestion-client';

export const dynamic = 'force-dynamic';

export default async function WorkerSuggestionPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard');

  const enabled = await hasFeature(session.contractorId, 'workerSuggestion');
  if (!enabled) redirect('/feature-disabled?feature=workerSuggestion');

  return <SuggestionClient />;
}
