import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WeatherNoticesClient from './_weather-notices-client';

export const dynamic = 'force-dynamic';

export default async function WeatherNoticesPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  return <WeatherNoticesClient />;
}
