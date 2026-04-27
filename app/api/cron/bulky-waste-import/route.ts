/**
 * POST /api/cron/bulky-waste-import — 매일 03시 자동 import (Bearer 인증)
 *
 * 외부 cron (Vercel Cron, K8s CronJob, GitHub Actions 등)에서 호출
 * 호출 예시:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your.app/api/cron/bulky-waste-import
 *
 * 동작:
 *  - autoEnabled=true 인 모든 BulkyWasteConfig 대상
 *  - 현재 KST 시각이 importTimeKst와 일치하는 config만 처리 (±10분 윈도우)
 *  - body { force: true } 면 시각 검사 생략
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runBulkyImport } from '@/lib/bulky-waste';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

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
  const results: Array<{ contractorId: string; ok: boolean; fetched: number; created: number; error?: string }> = [];

  for (const c of configs) {
    if (!force && diffMinutes(now, c.importTimeKst) > 10) continue;
    const r = await runBulkyImport(c.id, null, 'cron');
    results.push({
      contractorId: c.contractorId.toString(),
      ok: r.ok,
      fetched: r.fetched,
      created: r.created,
      error: r.error,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'CRON_BULKY_WASTE_IMPORT',
      resourceType: 'system',
      resourceId: now,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { triggeredAt: now, processed: results.length, force } as object,
    },
  });

  return NextResponse.json({ ok: true, kst: now, processed: results.length, results });
}
