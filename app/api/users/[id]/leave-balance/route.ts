/**
 * GET  /api/users/[id]/leave-balance — 워커 연도별 연차 잔여
 * POST /api/users/[id]/leave-balance — 연차 부여/조정 (upsert by year)
 *   { year, granted, carriedOver?, note? }
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers, leaveRemaining } from '@/lib/users';

export const runtime = 'nodejs';

const Body = z.object({
  year: z.number().int().min(2020).max(2100),
  granted: z.number().min(0).max(50),
  carriedOver: z.number().min(0).max(50).optional(),
  note: z.string().max(255).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerId = parseId(params.id);
  if (workerId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const u = await prisma.user.findFirst({ where: { id: workerId, ...userScope(session) }, select: { id: true } });
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const balances = await prisma.annualLeaveBalance.findMany({
    where: { workerId },
    orderBy: { year: 'desc' },
  });

  return NextResponse.json({
    items: balances.map((b) => ({
      id: b.id.toString(),
      year: b.year,
      granted: Number(b.granted.toString()),
      used: Number(b.used.toString()),
      carriedOver: Number(b.carriedOver.toString()),
      remaining: leaveRemaining(b),
      note: b.note,
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const workerId = parseId(params.id);
  if (workerId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const u = await prisma.user.findFirst({ where: { id: workerId, ...userScope(session) }, select: { id: true } });
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const result = await prisma.annualLeaveBalance.upsert({
    where: { workerId_year: { workerId, year: b.year } },
    create: {
      workerId, year: b.year,
      granted: b.granted,
      carriedOver: b.carriedOver ?? 0,
      note: b.note ?? null,
    },
    update: {
      granted: b.granted,
      carriedOver: b.carriedOver ?? 0,
      note: b.note ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LEAVE_BALANCE_GRANT',
      resourceType: 'user',
      resourceId: workerId.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { year: b.year, granted: b.granted, carriedOver: b.carriedOver ?? 0 } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    balance: {
      id: result.id.toString(),
      year: result.year,
      granted: Number(result.granted.toString()),
      used: Number(result.used.toString()),
      carriedOver: Number(result.carriedOver.toString()),
      remaining: leaveRemaining(result),
    },
  });
}
