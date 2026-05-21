/**
 * 관리자 답변 작성 — 회사 게시판형 공개 답변.
 * POST /api/admin/suggestions/[id]/reply  body: { content }
 *
 * 답변자는 익명이 아님 (이름·역할 노출). 답변 작성 시 status → ANSWERED.
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
  content: z.string().min(2).max(4000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId || sug.contractorId.toString() !== session.contractorId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const reply = await prisma.workerSuggestionReply.create({
    data: {
      suggestionId: id,
      repliedBy: BigInt(session.userId),
      content: parsed.data.content.trim(),
    },
    select: { id: true, createdAt: true },
  });

  await prisma.workerSuggestion.update({
    where: { id },
    data: { status: 'ANSWERED' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'WORKER_SUGGESTION_REPLY',
      resourceType: 'worker_suggestion',
      resourceId: id.toString(),
      contractorId: sug.contractorId,
      metadata: { replyId: reply.id.toString() },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, replyId: reply.id.toString(), createdAt: reply.createdAt.toISOString() });
}
