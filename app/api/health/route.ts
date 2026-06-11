import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMasterKey } from '@/lib/kms';
import { checkChromiumPath } from '@/lib/report/pdf-renderer';

export const runtime = 'nodejs';

export async function GET() {
  const results = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    Promise.race([
      getMasterKey(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]),
  ]);

  const dbOk = results[0].status === 'fulfilled';
  const kmsResult = results[1];
  const kmsOk = kmsResult.status === 'fulfilled';
  const kmsProvider = kmsOk ? (kmsResult.value as { provider: string }).provider : undefined;
  const kmsError = kmsResult.status === 'rejected'
    ? (kmsResult.reason instanceof Error ? kmsResult.reason.message : String(kmsResult.reason))
    : undefined;

  const chromium = checkChromiumPath();

  const weatherProvider = (process.env.WEATHER_PROVIDER ?? 'mock').toLowerCase();
  const weatherKeySet =
    weatherProvider === 'openweather' ? !!process.env.OPENWEATHER_API_KEY
    : weatherProvider === 'kma' ? !!process.env.KMA_API_KEY
    : true;

  const ok = dbOk && kmsOk;

  const body = {
    ok,
    db: dbOk ? 'up' : 'down',
    kms: { ok: kmsOk, ...(kmsProvider ? { provider: kmsProvider } : {}), ...(kmsError ? { error: kmsError } : {}) },
    puppeteer: chromium,
    weather: { ok: weatherKeySet, provider: weatherProvider },
    ts: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
