/**
 * GET  /api/leave-requests — 가시범위 휴가 신청 목록
 * POST /api/leave-requests — 신규 휴가 신청 (관리자 직접 등록 또는 워커 본인)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope } from '@/lib/users';

export const runtime = 'nodejs';

const Create = z.object({
  workerId: z.string(),
  requestType: z.enum([
    'ANNUAL', 'ANNUAL_HALF', 'SPECIAL', 'MATERNITY', 'FAMILY_CARE', 'MENSTRUAL', 'OFFICIAL',
    'SICK', 'BUSINESS_TRIP', 'TRAINING', 'OTHER',
  ]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const workerId = url.searchParams.get('workerId');

  const where: Prisma.LeaveRequestWhereInput = {};
  if (session.role === 'WORKER') {
    where.workerId = BigInt(session.userId);
  } else {
    where.worker = userScope(session);
  }
  if (status) where.status = status as Prisma.LeaveRequestWhereInput['status'];
  if (workerId) where.workerId = BigInt(workerId);

  const items = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    take: 200,
    include: { worker: { select: { id: true, name: true, employeeNo: true } } },
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id.toString(),
      workerId: r.workerId.toString(),
      workerName: r.worker.name,
      employeeNo: r.worker.employeeNo,
      requestType: r.requestType,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      reason: r.reason,
      status: r.status,
      approvedBy: r.approvedBy?.toString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  /* WORKER는 본인만 신청 가능 */
  if (session.role === 'WORKER' && b.workerId !== session.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  /* 관리자는 가시범위 내 워커만 */
  if (session.role !== 'WORKER') {
    const u = await prisma.user.findFirst({
      where: { id: BigInt(b.workerId), ...userScope(session) },
      select: { id: true },
    });
    if (!u) return NextResponse.json({ error: 'worker_not_found' }, { status: 404 });
  }

  const start = new Date(b.startDate);
  const end = new Date(b.endDate);
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
  }
  /* 반차: 시작일=종료일 강제 */
  if (b.requestType === 'ANNUAL_HALF' && start.getTime() !== end.getTime()) {
    return NextResponse.json({ error: 'half_day_must_be_single_day' }, { status: 400 });
  }

  const created = await prisma.leaveRequest.create({
    data: {
      workerId: BigInt(b.workerId),
      requestType: b.requestType,
      startDate: start,
      endDate: end,
      reason: b.reason ?? null,
      status: 'PENDING',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LEAVE_REQUEST_CREATE',
      resourceType: 'leave_request',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { workerId: b.workerId, type: b.requestType } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() }, { status: 201 });
}
