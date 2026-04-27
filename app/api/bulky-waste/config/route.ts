/**
 * GET  /api/bulky-waste/config — 본인 위탁업체 설정
 * POST /api/bulky-waste/config — 설정 upsert
 *   body: { ppaegiUsername?, ppaegiPassword?, importTimeKst?, resolveTimeKst?,
 *           autoEnabled?, adminDongCodes? (CSV) }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { encryptField } from '@/lib/crypto';

export const runtime = 'nodejs';

const Body = z.object({
  ppaegiUsername: z.string().max(100).nullable().optional(),
  ppaegiPassword: z.string().max(200).nullable().optional(),
  importTimeKst: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  resolveTimeKst: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  autoEnabled: z.boolean().optional(),
  adminDongCodes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ config: null });

  const c = await prisma.bulkyWasteConfig.findUnique({
    where: { contractorId: BigInt(session.contractorId) },
  });
  if (!c) return NextResponse.json({ config: null });

  return NextResponse.json({
    config: {
      id: c.id.toString(),
      ppaegiUsername: c.ppaegiUsername,
      hasPassword: !!c.ppaegiPasswordEnc,
      lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
      lastLoginOk: c.lastLoginOk,
      lastLoginMessage: c.lastLoginMessage,
      importTimeKst: c.importTimeKst,
      resolveTimeKst: c.resolveTimeKst,
      autoEnabled: c.autoEnabled,
      adminDongCodes: c.adminDongCodes,
      lastImportAt: c.lastImportAt?.toISOString() ?? null,
      lastImportCount: c.lastImportCount,
      lastResolveAt: c.lastResolveAt?.toISOString() ?? null,
      lastResolveCount: c.lastResolveCount,
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
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const contractorId = BigInt(session.contractorId);

  const data: Record<string, unknown> = {};
  if (b.ppaegiUsername !== undefined) data.ppaegiUsername = b.ppaegiUsername;
  if (b.ppaegiPassword !== undefined) {
    data.ppaegiPasswordEnc = b.ppaegiPassword == null || b.ppaegiPassword === ''
      ? null
      : await encryptField(b.ppaegiPassword);
  }
  if (b.importTimeKst !== undefined) data.importTimeKst = b.importTimeKst;
  if (b.resolveTimeKst !== undefined) data.resolveTimeKst = b.resolveTimeKst;
  if (b.autoEnabled !== undefined) data.autoEnabled = b.autoEnabled;
  if (b.adminDongCodes !== undefined) data.adminDongCodes = b.adminDongCodes;

  const upserted = await prisma.bulkyWasteConfig.upsert({
    where: { contractorId },
    create: { contractorId, ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'BULKY_WASTE_CONFIG_UPDATE',
      resourceType: 'bulky_waste_config',
      resourceId: upserted.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        fields: Object.keys(data),
        passwordChanged: 'ppaegiPasswordEnc' in data,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, id: upserted.id.toString() });
}
