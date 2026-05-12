/**
 * GET  /api/live-tracking/config — 본인 위탁업체 설정
 * POST /api/live-tracking/config — upsert
 *   body: { gisProvider?, gisBaseUrl?, apiKey?, embedUrl?, refreshSec?, active? }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { encryptField } from '@/lib/crypto';

export const runtime = 'nodejs';

const Body = z.object({
  gisProvider: z.enum(['simulation', 'helpbiz', 'naver', 'kakao', 'local']).optional(),
  gisBaseUrl: z.string().max(255).nullable().optional(),
  apiKey: z.string().max(200).nullable().optional(),
  embedUrl: z.string().max(500).nullable().optional(),
  refreshSec: z.number().int().min(2).max(300).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ config: null });

  const c = await prisma.liveTrackingConfig.findUnique({
    where: { contractorId: BigInt(session.contractorId) },
  });
  if (!c) return NextResponse.json({ config: null });

  return NextResponse.json({
    config: {
      gisProvider: c.gisProvider,
      gisBaseUrl: c.gisBaseUrl,
      hasApiKey: !!c.apiKeyEnc,
      embedUrl: c.embedUrl,
      refreshSec: c.refreshSec,
      active: c.active,
      updatedAt: c.updatedAt.toISOString(),
    },
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;
  const contractorId = BigInt(session.contractorId);

  const data: Record<string, unknown> = {};
  if (b.gisProvider !== undefined) data.gisProvider = b.gisProvider;
  if (b.gisBaseUrl !== undefined) data.gisBaseUrl = b.gisBaseUrl;
  if (b.apiKey !== undefined) {
    data.apiKeyEnc = b.apiKey == null || b.apiKey === '' ? null : await encryptField(b.apiKey);
  }
  if (b.embedUrl !== undefined) data.embedUrl = b.embedUrl;
  if (b.refreshSec !== undefined) data.refreshSec = b.refreshSec;
  if (b.active !== undefined) data.active = b.active;

  const upserted = await prisma.liveTrackingConfig.upsert({
    where: { contractorId },
    create: { contractorId, ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LIVE_TRACKING_CONFIG_UPDATE',
      resourceType: 'live_tracking_config',
      resourceId: upserted.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(data), apiKeyChanged: 'apiKeyEnc' in data } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
