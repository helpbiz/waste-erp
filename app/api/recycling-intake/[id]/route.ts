/**
 * PATCH /api/recycling-intake/[id]
 * DELETE /api/recycling-intake/[id]
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Patch = z.object({
  intakeDate: z.string().optional(),
  intakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  facilityId: z.string().nullable().optional(),
  materialCategory: z.enum(['GENERAL', 'FOOD', 'RECYCLING', 'WOOD']).optional(),
  weightTon: z.number().min(0).max(99_999).optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.recyclingCenterIntake.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.intakeDate !== undefined) data.intakeDate = new Date(b.intakeDate);
  if (b.intakeTime !== undefined) data.intakeTime = b.intakeTime;
  if (b.materialCategory !== undefined) data.materialCategory = b.materialCategory;
  if (b.weightTon !== undefined) data.weightTon = b.weightTon;
  if (b.note !== undefined) data.note = b.note;
  if (b.facilityId !== undefined) {
    if (b.facilityId === null) {
      data.facilityId = null;
    } else {
      /* 지자체 단위 — 본인 contractor 의 muni 산하 facility 만 허용 */
      const myMuniId = (await prisma.contractor.findUnique({
        where: { id: BigInt(session.contractorId) },
        select: { municipalityId: true },
      }))?.municipalityId;
      const f = myMuniId
        ? await prisma.wasteTreatmentFacility.findFirst({
            where: { id: BigInt(b.facilityId), municipalityId: myMuniId, active: true },
            select: { id: true },
          })
        : null;
      if (!f) return NextResponse.json({ error: 'invalid_facility' }, { status: 400 });
      data.facilityId = f.id;
    }
  }

  await prisma.recyclingCenterIntake.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'MUNI_ADMIN' || session.role === 'WORKER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.recyclingCenterIntake.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.recyclingCenterIntake.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
