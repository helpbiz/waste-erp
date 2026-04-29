/**
 * P2-1: SUPER_ADMIN 사용자 잠금/해제 토글.
 * POST: { action: 'lock' | 'unlock' }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const Body = z.object({ action: z.enum(['lock', 'unlock']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const id = BigInt(params.id);
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, contractorId: true, municipalityId: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (parsed.data.action === 'lock') {
    /* 100년 후 unlock 시점 — 사실상 영구 잠금 */
    const farFuture = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000);
    await prisma.user.update({
      where: { id },
      data: { lockedUntil: farFuture, failedLoginAttempts: 0 },
    });
  } else {
    await prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  await writeAudit(req, session, {
    action: parsed.data.action === 'lock' ? 'USER_LOCK' : 'USER_UNLOCK',
    resourceType: 'user',
    resourceId: id.toString(),
    contractorId: target.contractorId,
    municipalityId: target.municipalityId,
    metadata: { username: target.username, crossTenant: true },
  });

  return NextResponse.json({ ok: true });
}
