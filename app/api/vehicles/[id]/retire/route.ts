/**
 * POST /api/vehicles/[id]/retire — 차량 폐차 (soft delete: status=RETIRED)
 *  - 권한: SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN
 *  - 사유 필수 + audit_log 영구 보존
 *  - RETIRED 차량은 운행일지 작성 차단 (vehicle-logs POST에서 검증)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleWhere, isVehicleLogManager } from '@/lib/vehicle-logs';

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
  const target = await prisma.vehicle.findFirst({ where: { id, ...vehicleWhere(session) } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target.status === 'RETIRED') {
    return NextResponse.json({ error: 'already_retired' }, { status: 409 });
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { status: 'RETIRED' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_RETIRE',
      resourceType: 'vehicle',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleNo: target.vehicleNo, reasonLen: parsed.data.reason.length } as object,
    },
  });

  return NextResponse.json({ ok: true, vehicle: { id: updated.id.toString(), status: updated.status } });
}
