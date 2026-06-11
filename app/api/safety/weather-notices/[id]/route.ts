/**
 * PATCH /api/safety/weather-notices/[id] — 공지 수정 (관리자)
 * DELETE /api/safety/weather-notices/[id] — 공지 삭제 (관리자)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

const PatchBody = z.object({
  alertType: z.enum(['HEATWAVE', 'COLDWAVE', 'TYPHOON', 'STORM', 'OTHER']).optional(),
  title: z.string().trim().min(2).max(100).optional(),
  content: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  let id: bigint;
  try { id = BigInt(params.id); } catch { return NextResponse.json({ error: 'invalid_id' }, { status: 400 }); }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.weatherSafetyNotice.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
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
    },
    select: { id: true, alertType: true, title: true, content: true },
  });

  return NextResponse.json({ ok: true, notice: { ...updated, id: updated.id.toString() } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  let id: bigint;
  try { id = BigInt(params.id); } catch { return NextResponse.json({ error: 'invalid_id' }, { status: 400 }); }

  const existing = await prisma.weatherSafetyNotice.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.weatherSafetyPhoto.deleteMany({ where: { noticeId: id } });
  await prisma.weatherSafetyNotice.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
