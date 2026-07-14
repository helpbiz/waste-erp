/**
 * PATCH  /api/admin/tbm-schedules/[id] — 수정 (활성화 시 최대 5개 제한 재검증)
 * DELETE /api/admin/tbm-schedules/[id] — 삭제
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);
const MAX_ACTIVE_SCHEDULES = 5;
const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const PatchBody = z.object({
  label: z.string().trim().min(1).max(30).optional(),
  timeOfDay: z.string().regex(TimeRegex).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const contractorId = BigInt(session.contractorId);
  const target = await prisma.tbmSchedule.findFirst({ where: { id, contractorId } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (parsed.data.isActive === true && !target.isActive) {
    const activeCount = await prisma.tbmSchedule.count({ where: { contractorId, isActive: true } });
    if (activeCount >= MAX_ACTIVE_SCHEDULES) {
      return NextResponse.json({ error: 'schedule_limit_reached', limit: MAX_ACTIVE_SCHEDULES }, { status: 409 });
    }
  }

  const updated = await prisma.tbmSchedule.update({ where: { id }, data: parsed.data });

  return NextResponse.json({
    ok: true,
    item: { id: updated.id.toString(), label: updated.label, timeOfDay: updated.timeOfDay, isActive: updated.isActive, sortOrder: updated.sortOrder },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.tbmSchedule.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.tbmSchedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
