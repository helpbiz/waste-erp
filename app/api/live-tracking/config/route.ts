/**
 * GET  /api/live-tracking/config — 본인 위탁업체 설정
 *      SUPER_ADMIN: ?contractorId=<id> 로 특정 업체 조회 가능
 * POST /api/live-tracking/config — upsert
 *   body: { gisProvider?, gisBaseUrl?, apiKey?, embedUrl?, refreshSec?, active?, contractorId? }
 *   SUPER_ADMIN: body.contractorId 로 특정 업체 저장 가능
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { encryptField } from '@/lib/crypto';

export const runtime = 'nodejs';

const Body = z.object({
  contractorId: z.union([z.string(), z.number()]).optional(),
  gisProvider: z.enum(['simulation', 'helpbiz', 'naver', 'kakao', 'local', 'etrace']).optional(),
  gisBaseUrl: z.string().max(255).nullable().optional(),
  apiKey: z.string().max(200).nullable().optional(),
  embedUrl: z.string().max(500).nullable().optional(),
  refreshSec: z.number().int().min(2).max(300).optional(),
  active: z.boolean().optional(),
});

function resolveContractorId(session: { role: string; contractorId: string | null }, overrideId?: string | number): bigint | null {
  if (overrideId !== undefined && session.role === 'SUPER_ADMIN') {
    try { return BigInt(overrideId); } catch { return null; }
  }
  return session.contractorId ? BigInt(session.contractorId) : null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const override = url.searchParams.get('contractorId') ?? undefined;
  const contractorId = resolveContractorId(session, override);
  if (!contractorId) return NextResponse.json({ config: null });

  const c = await prisma.liveTrackingConfig.findUnique({ where: { contractorId } });
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
  if (!canManageUsers(session.role) && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;

  const contractorId = resolveContractorId(session, b.contractorId);
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

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
      metadata: { fields: Object.keys(data), apiKeyChanged: 'apiKeyEnc' in data, targetContractorId: contractorId.toString() } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
