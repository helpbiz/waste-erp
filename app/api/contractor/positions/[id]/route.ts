// Design Ref: §4.2 — 직책 수정·비활성화. Plan SC: FR-05
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const PatchBody = z.object({
  name: z.string().min(1).max(50).optional(),
  category: z.enum(['MANAGER', 'FIELD', 'ADMIN']).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = BigInt(params.id);
  const pos = await prisma.contractorPosition.findUnique({ where: { id } });
  if (!pos) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (session.role === 'CONTRACTOR_ADMIN') {
    if (!session.contractorId || pos.contractorId !== BigInt(session.contractorId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const body = await req.json();
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Plan SC: FR-05 — 사용 중인 직책 비활성화 방지
  if (data.active === false) {
    const userCount = await prisma.user.count({ where: { contractorPositionId: id } });
    if (userCount > 0) {
      return NextResponse.json({ error: 'in_use', userCount }, { status: 409 });
    }
  }

  const updated = await prisma.contractorPosition.update({ where: { id }, data });

  await writeAudit(req, session, {
    action: 'contractor_position_update',
    resourceType: 'contractor_position',
    resourceId: String(id),
    metadata: data,
  });

  return NextResponse.json({
    position: { id: String(updated.id), name: updated.name, category: updated.category, sortOrder: updated.sortOrder, active: updated.active },
  });
}
