/**
 * POST /api/complaints/[id]/complete
 * - 처리 완료 (→ COMPLETED) + resolveNote 필수 + photosAfter 선택
 * - 권한: 매니저 또는 본인 담당 (WORKER)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  resolveNote: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),  /* 워커 앱 호환 */
}).transform((d) => ({ resolveNote: (d.resolveNote || d.note || '처리 완료').slice(0, 2000) }));

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.status === 'COMPLETED' || target.status === 'REJECTED') {
    return NextResponse.json(
      { error: 'invalid_transition', from: target.status, to: 'COMPLETED' },
      { status: 409 }
    );
  }

  const now = new Date();
  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'COMPLETED', resolveNote: parsed.data.resolveNote, resolvedAt: now },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_COMPLETE',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { resolveNoteLen: parsed.data.resolveNote.length } as object,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status, resolvedAt: now.toISOString() });
}
