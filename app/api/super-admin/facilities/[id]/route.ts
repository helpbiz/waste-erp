/**
 * PATCH /api/super-admin/facilities/[id] — 수정 또는 비활성화 (active 토글)
 *   body: { type?, name?, address?, active? }
 *
 * Design Ref: §4.1 — 마스터 CRUD
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isFacilityType } from '@/lib/facility';

export const runtime = 'nodejs';

const PatchBody = z.object({
  type: z.string().refine(isFacilityType, { message: 'invalid_type' }).optional(),
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const allowed = ['SUPER_ADMIN', 'INTERNAL_ADMIN', 'CONTRACTOR_ADMIN'];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.wasteTreatmentFacility.findUnique({
    where: { id },
    select: { id: true, contractorId: true, type: true, name: true, address: true, active: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // 자사 검증 (SUPER_ADMIN 제외)
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId || BigInt(session.contractorId) !== target.contractorId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  // Design Ref: §6.1 — duplicate_facility 체크 (type/name 변경 시)
  const newType = b.type ?? target.type;
  const newName = b.name ?? target.name;
  if (newType !== target.type || newName !== target.name) {
    const dup = await prisma.wasteTreatmentFacility.findFirst({
      where: {
        contractorId: target.contractorId,
        type: newType,
        name: newName,
        id: { not: id },
      },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: 'duplicate_facility' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (b.type !== undefined) data.type = b.type;
  if (b.name !== undefined) data.name = b.name;
  if (b.address !== undefined) data.address = b.address;
  if (b.active !== undefined) data.active = b.active;

  await prisma.wasteTreatmentFacility.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: b.active === false ? 'FACILITY_DEACTIVATE' : 'FACILITY_UPDATE',
      resourceType: 'waste_treatment_facility',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: data as object,
    },
  });

  return NextResponse.json({ ok: true });
}
