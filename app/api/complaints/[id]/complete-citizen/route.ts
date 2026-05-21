/**
 * POST /api/complaints/[id]/complete-citizen — 시민 민원 처리 완료 (도8 840)
 *
 *  - 청구항 4: 처리 시각 + 처리 완료 촬영 이미지 송신
 *  - 권한: 매니저 또는 본인 담당 워커
 *  - 만족도 평가는 별도 API에서 시민이 입력 (S660)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  resolveNote: z.string().trim().min(2).max(2000),
  completionImage: z.string().max(2_000_000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.status === 'COMPLETED' || target.status === 'REJECTED') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
  }

  const now = new Date();
  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      resolveNote: parsed.data.resolveNote,
      resolvedAt: now,
      completionImage: parsed.data.completionImage ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_COMPLETE_CITIZEN',
      resourceType: 'complaint',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        hasImage: !!parsed.data.completionImage,
        noteLen: parsed.data.resolveNote.length,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    status: updated.status,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}
