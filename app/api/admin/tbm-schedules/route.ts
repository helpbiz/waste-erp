/**
 * GET  /api/admin/tbm-schedules  — TBM 시간 슬롯 목록
 * POST /api/admin/tbm-schedules  — 슬롯 추가 (계약업체당 활성 최대 5개)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);
const MAX_ACTIVE_SCHEDULES = 5;
const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function isAllowed(role: string) {
  return ALLOWED.has(role);
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAllowed(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const items = await prisma.tbmSchedule.findMany({
    where: { contractorId: BigInt(session.contractorId) },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, label: true, timeOfDay: true, isActive: true, sortOrder: true },
  });

  return NextResponse.json({
    items: items.map((s) => ({ ...s, id: s.id.toString() })),
  });
}

const PostBody = z.object({
  label: z.string().trim().min(1).max(30),
  timeOfDay: z.string().regex(TimeRegex),
  sortOrder: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAllowed(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contractorId = BigInt(session.contractorId);
  const existing = await prisma.tbmSchedule.findFirst({ where: { contractorId, label: parsed.data.label } });
  if (existing) return NextResponse.json({ error: 'already_exists' }, { status: 409 });

  const activeCount = await prisma.tbmSchedule.count({ where: { contractorId, isActive: true } });
  if (activeCount >= MAX_ACTIVE_SCHEDULES) {
    return NextResponse.json({ error: 'schedule_limit_reached', limit: MAX_ACTIVE_SCHEDULES }, { status: 409 });
  }

  const item = await prisma.tbmSchedule.create({
    data: {
      contractorId,
      label: parsed.data.label,
      timeOfDay: parsed.data.timeOfDay,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json({
    ok: true,
    item: { id: item.id.toString(), label: item.label, timeOfDay: item.timeOfDay, isActive: item.isActive, sortOrder: item.sortOrder },
  }, { status: 201 });
}
