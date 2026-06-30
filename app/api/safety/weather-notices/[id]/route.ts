/**
 * PATCH /api/safety/weather-notices/[id] — 공지 수정 (관리자 또는 isNoticeManager 근로자·본인 작성)
 * DELETE /api/safety/weather-notices/[id] — 공지 삭제 (관리자 또는 isNoticeManager 근로자·본인 작성)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession, type SessionPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

async function canManageNotice(session: SessionPayload): Promise<boolean> {
  if (isManager(session.role)) return true;
  if (session.role === 'WORKER' && session.contractorId) {
    const u = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isNoticeManager: true } });
    return u?.isNoticeManager === true;
  }
  return false;
}

const PatchBody = z.object({
  alertType: z.enum(['HEATWAVE', 'COLDWAVE', 'TYPHOON', 'STORM', 'OTHER']).optional(),
  title: z.string().trim().min(2).max(100).optional(),
  content: z.string().trim().max(2000).nullable().optional(),
  noticePhoto: z.string().max(1_200_000, '사진 크기가 너무 큽니다.').nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!await canManageNotice(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  let id: bigint;
  try { id = BigInt(params.id); } catch { return NextResponse.json({ error: 'invalid_id' }, { status: 400 }); }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  /* isNoticeManager 근로자는 본인이 작성한 공지만 수정 가능 */
  const createdByFilter = !isManager(session.role)
    ? { createdBy: BigInt(session.userId) }
    : {};
  const existing = await prisma.weatherSafetyNotice.findFirst({
    where: { id, contractorId: BigInt(session.contractorId), ...createdByFilter },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const b = parsed.data;
  const updated = await prisma.weatherSafetyNotice.update({
    where: { id },
    data: {
      ...(b.alertType !== undefined ? { alertType: b.alertType } : {}),
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.content !== undefined ? { content: b.content } : {}),
      ...(b.noticePhoto !== undefined ? { noticePhoto: b.noticePhoto } : {}),
    },
    select: { id: true, alertType: true, title: true, content: true, noticePhoto: true },
  });

  return NextResponse.json({ ok: true, notice: { ...updated, id: updated.id.toString() } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!await canManageNotice(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  let id: bigint;
  try { id = BigInt(params.id); } catch { return NextResponse.json({ error: 'invalid_id' }, { status: 400 }); }

  /* isNoticeManager 근로자는 본인이 작성한 공지만 삭제 가능 */
  const createdByFilter = !isManager(session.role)
    ? { createdBy: BigInt(session.userId) }
    : {};
  const existing = await prisma.weatherSafetyNotice.findFirst({
    where: { id, contractorId: BigInt(session.contractorId), ...createdByFilter },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.weatherSafetyPhoto.deleteMany({ where: { noticeId: id } });
  await prisma.weatherSafetyNotice.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
