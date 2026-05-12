/**
 * POST /api/complaints/[id]/complete
 * - 처리 완료 (→ COMPLETED) + resolveNote 선택 + taggedUserId 선택
 * - 권한: 매니저 또는 본인 담당 (WORKER)
 * - taggedUserId 전달 시 해당 워커에게 개인 공지(Announcement) 자동 생성
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  resolveNote: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),          /* 워커 앱 호환 */
  requestImage: z.string().max(2_000_000).optional(),    /* 완료 사진 */
  taggedUserId: z.string().optional(),                   /* 담당자 태그 (userId 문자열) */
}).transform((d) => ({
  resolveNote: (d.resolveNote || d.note || '처리 완료').slice(0, 2000),
  requestImage: d.requestImage ?? null,
  taggedUserId: d.taggedUserId ?? null,
}));

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
  const { resolveNote, requestImage, taggedUserId } = parsed.data;

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session) },
    select: { id: true, status: true, assignedTo: true, locationAddress: true, contractorId: true },
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
  const updateData: Record<string, unknown> = {
    status: 'COMPLETED',
    resolveNote,
    resolvedAt: now,
  };
  if (requestImage) updateData.requestImage = requestImage;

  const updated = await prisma.complaint.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_COMPLETE',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { resolveNoteLen: resolveNote.length, hasTag: !!taggedUserId } as object,
    },
  });

  /* 담당자 태그 → 개인 공지(Announcement) 생성 */
  if (taggedUserId && target.contractorId) {
    const taggedUser = await prisma.user.findUnique({
      where: { id: BigInt(taggedUserId) },
      select: { name: true },
    });
    if (taggedUser) {
      const addr = target.locationAddress ? ` (${target.locationAddress})` : '';
      await prisma.announcement.create({
        data: {
          title: `[민원 완료] ${taggedUser.name}님께 알림`,
          body: `민원${addr}이 완료 처리되었습니다.\n\n처리 내용: ${resolveNote}`,
          severity: 'INFO',
          audience: 'WORKER',
          contractorId: target.contractorId,
          targetUserId: BigInt(taggedUserId),
          createdBy: BigInt(session.userId),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), /* 7일 후 만료 */
        },
      });
    }
  }

  return NextResponse.json({ ok: true, status: updated.status, resolvedAt: now.toISOString() });
}
