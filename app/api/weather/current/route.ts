import { NextResponse } from 'next/server';
import { fetchWeatherCached } from '@/lib/weather-providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const w = await fetchWeatherCached();
  return NextResponse.json(w);
}
