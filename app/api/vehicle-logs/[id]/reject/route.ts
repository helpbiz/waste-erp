/**
 * POST /api/vehicle-logs/[id]/reject — SUBMITTED → DRAFT (매니저, 사유 필수)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager, vehicleLogWhere } from '@/lib/vehicle-logs';

export const runtime = 'nodejs';

const Body = z.object({ reason: z.string().trim().min(2).max(500) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const id = BigInt(params.id);
  const log = await prisma.vehicleLog.findFirst({ where: { id, ...vehicleLogWhere(session) } });
  if (!log) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (log.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'invalid_transition', from: log.status, to: 'DRAFT' }, { status: 409 });
  }

  const updated = await prisma.vehicleLog.update({
    where: { id },
    data: { status: 'DRAFT' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_REJECT',
      resourceType: 'vehicle_log',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { reasonLen: parsed.data.reason.length } as object,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
