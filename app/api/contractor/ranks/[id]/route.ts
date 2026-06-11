// Design Ref: §4.4 — 직급 수정·비활성화. Plan SC: FR-06
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const PatchBody = z.object({
  name: z.string().min(1).max(50).optional(),
  level: z.number().int().min(1).max(99).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const rank = await prisma.contractorRank.findUnique({ where: { id } });
  if (!rank) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (session.role === 'CONTRACTOR_ADMIN') {
    if (!session.contractorId || rank.contractorId !== BigInt(session.contractorId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.active === false) {
    const userCount = await prisma.user.count({ where: { rankId: id } });
    if (userCount > 0) {
      return NextResponse.json({ error: 'in_use', userCount }, { status: 409 });
    }
  }

  const updated = await prisma.contractorRank.update({ where: { id }, data });

  await writeAudit(req, session, {
    action: 'contractor_rank_update',
    resourceType: 'contractor_rank',
    resourceId: String(id),
    metadata: data,
  });

  return NextResponse.json({
    rank: { id: String(updated.id), name: updated.name, level: updated.level, sortOrder: updated.sortOrder, active: updated.active },
  });
}
