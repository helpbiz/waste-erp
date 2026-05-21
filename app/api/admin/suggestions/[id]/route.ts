/**
 * 관리자 — 건의 상태 변경 (REVIEWING / ARCHIVED).
 * PATCH /api/admin/suggestions/[id]  body: { status }
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';

export const runtime = 'nodejs';

const MUTATOR_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

const Body = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'ANSWERED', 'ARCHIVED']),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!MUTATOR_ROLES.has(session.role) || !canMutate(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const sug = await prisma.workerSuggestion.findUnique({
    where: { id },
    select: { id: true, contractorId: true },
  });
  if (!sug) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* contractor scope — SUPER 외에는 본인 회사만 */
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId || sug.contractorId.toString() !== session.contractorId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  await prisma.workerSuggestion.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'WORKER_SUGGESTION_STATUS',
      resourceType: 'worker_suggestion',
      resourceId: id.toString(),
      contractorId: sug.contractorId,
      metadata: { newStatus: parsed.data.status },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
