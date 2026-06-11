/**
 * POST /api/cron/bulky-waste-resolve — 매일 17시 자동 처리 완료
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runBulkyResolve } from '@/lib/bulky-waste';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';

const authorized = isCronAuthorized;

function nowKstHHMM(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

function diffMinutes(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return Math.abs((ah - bh) * 60 + (am - bm));
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const force = body.force === true;
  const now = nowKstHHMM();

  const configs = await prisma.bulkyWasteConfig.findMany({ where: { autoEnabled: true } });
  const results: Array<{ contractorId: string; ok: boolean; resolved: number; error?: string }> = [];

  for (const c of configs) {
    if (!force && diffMinutes(now, c.resolveTimeKst) > 10) continue;
    const r = await runBulkyResolve(c.id, null, 'cron');
    results.push({
      contractorId: c.contractorId.toString(),
      ok: r.ok,
      resolved: r.resolved,
      error: r.error,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'CRON_BULKY_WASTE_RESOLVE',
      resourceType: 'system',
      resourceId: now,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { triggeredAt: now, processed: results.length, force } as object,
    },
  });

  return NextResponse.json({ ok: true, kst: now, processed: results.length, results });
}
