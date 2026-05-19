/**
 * PATCH  /api/contractor/zones/[id] — 담당구역 수정
 * DELETE /api/contractor/zones/[id] — 담당구역 삭제
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PatchBody = z.object({
  zoneName: z.string().trim().min(1).max(100).optional(),
  zoneCode: z.string().trim().min(1).max(20).optional(),
  areaKm2: z.number().positive().nullable().optional(),
});

async function getZoneForContractor(id: string, contractorId: string) {
  return prisma.cleaningZone.findFirst({
    where: { id: BigInt(id), contractorId: BigInt(contractorId) },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const zone = await getZoneForContractor(params.id, session.contractorId);
  if (!zone) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const b = parsed.data;

  if (b.zoneCode && b.zoneCode !== zone.zoneCode) {
    const dup = await prisma.cleaningZone.findFirst({
      where: { contractorId: BigInt(session.contractorId), zoneCode: b.zoneCode, id: { not: zone.id } },
    });
    if (dup) return NextResponse.json({ error: 'zone_code_duplicate' }, { status: 409 });
  }

  await prisma.cleaningZone.update({
    where: { id: zone.id },
    data: {
      ...(b.zoneName !== undefined ? { zoneName: b.zoneName } : {}),
      ...(b.zoneCode !== undefined ? { zoneCode: b.zoneCode } : {}),
      ...(b.areaKm2 !== undefined ? { areaKm2: b.areaKm2 } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const zone = await getZoneForContractor(params.id, session.contractorId);
  if (!zone) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [complaintCount, vlCount] = await Promise.all([
    prisma.complaint.count({ where: { zoneId: zone.id } }),
    prisma.vehicleLog.count({ where: { zoneId: zone.id } }),
  ]);
  if (complaintCount + vlCount > 0) {
    return NextResponse.json({ error: 'zone_in_use', complaintCount, vehicleLogCount: vlCount }, { status: 409 });
  }

  await prisma.adminDong.deleteMany({ where: { zoneId: zone.id } });
  await prisma.cleaningZone.delete({ where: { id: zone.id } });

  return NextResponse.json({ ok: true });
}
