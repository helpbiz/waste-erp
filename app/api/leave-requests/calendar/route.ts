/**
 * GET /api/leave-requests/calendar?ym=YYYY-MM
 *  - 가시범위 내 모든 LeaveRequest 중, 월과 겹치는 항목을 반환
 *  - 일자별 요약(map[date]={count, types[]})도 함께
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const ym = url.searchParams.get('ym') ?? new Date().toISOString().slice(0, 7);
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return NextResponse.json({ error: 'invalid_ym' }, { status: 400 });
  const year = Number(m[1]);
  const month = Number(m[2]);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const where: Prisma.LeaveRequestWhereInput = {
    worker: userScope(session),
    /* 기간이 월과 겹침 */
    AND: [
      { startDate: { lte: monthEnd } },
      { endDate: { gte: monthStart } },
    ],
  };

  const items = await prisma.leaveRequest.findMany({
    where,
    include: { worker: { select: { id: true, name: true, employeeNo: true } } },
    orderBy: { startDate: 'asc' },
  });

  /* 일자별 요약 (status=APPROVED만 색칠, PENDING은 striped 표시용) */
  const dayMap: Record<string, {
    approved: number;
    pending: number;
    rejected: number;
    types: string[];
    workers: string[];
  }> = {};
  for (const r of items) {
    const start = new Date(Math.max(r.startDate.getTime(), monthStart.getTime()));
    const end = new Date(Math.min(r.endDate.getTime(), monthEnd.getTime()));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      if (!dayMap[k]) dayMap[k] = { approved: 0, pending: 0, rejected: 0, types: [], workers: [] };
      if (r.status === 'APPROVED') dayMap[k].approved++;
      else if (r.status === 'PENDING') dayMap[k].pending++;
      else dayMap[k].rejected++;
      if (!dayMap[k].types.includes(r.requestType)) dayMap[k].types.push(r.requestType);
      if (!dayMap[k].workers.includes(r.worker.name)) dayMap[k].workers.push(r.worker.name);
    }
  }

  return NextResponse.json({
    ym,
    items: items.map((r) => ({
      id: r.id.toString(),
      workerId: r.workerId.toString(),
      workerName: r.worker.name,
      employeeNo: r.worker.employeeNo,
      requestType: r.requestType,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      status: r.status,
    })),
    dayMap,
  });
}
