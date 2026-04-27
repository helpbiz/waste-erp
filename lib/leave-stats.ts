/**
 * 휴가 통계 집계 헬퍼
 * - 가시범위(userScope) 기반 LeaveRequest 조회
 * - 유형별 / 상태별 / 워커별 / 부서별 / 월별 집계
 * - 반차(ANNUAL_HALF)는 0.5일, 그 외는 일수(양끝 포함)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { userScope, type ScopeSession, leaveDayCount } from './users';

const ANNUAL_TYPES = new Set(['ANNUAL', 'ANNUAL_HALF']);

export type StatsRow = {
  id: string;
  workerId: string;
  workerName: string;
  workerEmployeeNo: string | null;
  departmentName: string | null;
  positionLabel: string | null;
  requestType: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  createdAt: string;
  firstApproverName: string | null;
  finalApproverName: string | null;
};

export type StatsResult = {
  range: { from: string; to: string };
  total: { requested: number; approved: number; inReview: number; rejected: number };
  totalDays: { requested: number; approved: number; annualUsed: number };
  byType: Record<string, { count: number; days: number }>;
  byStatus: Record<string, number>;
  byWorker: Array<{ workerId: string; workerName: string; employeeNo: string | null; count: number; days: number }>;
  byDepartment: Array<{ departmentName: string; count: number; days: number }>;
  byMonth: Array<{ ym: string; count: number; days: number }>;
  rows: StatsRow[];
};

export function leaveDays(requestType: string, startDate: Date, endDate: Date): number {
  if (requestType === 'ANNUAL_HALF') return 0.5;
  return leaveDayCount(startDate, endDate);
}

export async function collectLeaveStats(
  session: ScopeSession,
  range: { from: Date; to: Date },
  filter?: { requestType?: string; status?: string; workerId?: string; departmentId?: string }
): Promise<StatsResult> {
  /* 기간 겹침 — startDate ≤ to AND endDate ≥ from */
  const where: Prisma.LeaveRequestWhereInput = {
    worker: userScope(session),
    AND: [{ startDate: { lte: range.to } }, { endDate: { gte: range.from } }],
  };
  if (filter?.requestType) where.requestType = filter.requestType as Prisma.LeaveRequestWhereInput['requestType'];
  if (filter?.status) where.status = filter.status as Prisma.LeaveRequestWhereInput['status'];
  if (filter?.workerId) where.workerId = BigInt(filter.workerId);
  if (filter?.departmentId) {
    where.worker = { ...(where.worker as object), departmentId: BigInt(filter.departmentId) };
  }

  const items = await prisma.leaveRequest.findMany({
    where,
    include: {
      worker: {
        select: {
          id: true, name: true, employeeNo: true,
          department: { select: { name: true } },
          position: { select: { label: true } },
        },
      },
      firstApprovalEvent: { include: { actor: { select: { name: true } } } },
      finalApprovalEvent: { include: { actor: { select: { name: true } } } },
    },
    orderBy: { startDate: 'asc' },
  });

  const total = { requested: 0, approved: 0, inReview: 0, rejected: 0 };
  const totalDays = { requested: 0, approved: 0, annualUsed: 0 };
  const byType: StatsResult['byType'] = {};
  const byStatus: StatsResult['byStatus'] = {};
  const byWorkerMap = new Map<string, { workerId: string; workerName: string; employeeNo: string | null; count: number; days: number }>();
  const byDeptMap = new Map<string, { count: number; days: number }>();
  const byMonthMap = new Map<string, { count: number; days: number }>();
  const rows: StatsRow[] = [];

  for (const r of items) {
    const days = leaveDays(r.requestType, r.startDate, r.endDate);
    total.requested++;
    totalDays.requested += days;
    if (r.status === 'APPROVED') { total.approved++; totalDays.approved += days; if (ANNUAL_TYPES.has(r.requestType)) totalDays.annualUsed += days; }
    else if (r.status === 'IN_REVIEW') total.inReview++;
    else if (r.status === 'REJECTED') total.rejected++;

    const t = byType[r.requestType] ?? { count: 0, days: 0 };
    t.count++; t.days += days;
    byType[r.requestType] = t;

    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    const wkey = r.worker.id.toString();
    const wcur = byWorkerMap.get(wkey) ?? {
      workerId: wkey, workerName: r.worker.name, employeeNo: r.worker.employeeNo, count: 0, days: 0,
    };
    wcur.count++; wcur.days += days;
    byWorkerMap.set(wkey, wcur);

    const dname = r.worker.department?.name ?? '미지정';
    const dcur = byDeptMap.get(dname) ?? { count: 0, days: 0 };
    dcur.count++; dcur.days += days;
    byDeptMap.set(dname, dcur);

    /* 월별 — start 기준 */
    const ym = r.startDate.toISOString().slice(0, 7);
    const mcur = byMonthMap.get(ym) ?? { count: 0, days: 0 };
    mcur.count++; mcur.days += days;
    byMonthMap.set(ym, mcur);

    rows.push({
      id: r.id.toString(),
      workerId: wkey,
      workerName: r.worker.name,
      workerEmployeeNo: r.worker.employeeNo,
      departmentName: r.worker.department?.name ?? null,
      positionLabel: r.worker.position?.label ?? null,
      requestType: r.requestType,
      status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      days,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      firstApproverName: r.firstApprovalEvent?.actor.name ?? null,
      finalApproverName: r.finalApprovalEvent?.actor.name ?? null,
    });
  }

  return {
    range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10) },
    total,
    totalDays,
    byType,
    byStatus,
    byWorker: Array.from(byWorkerMap.values()).sort((a, b) => b.days - a.days),
    byDepartment: Array.from(byDeptMap.entries()).map(([departmentName, v]) => ({ departmentName, ...v }))
      .sort((a, b) => b.days - a.days),
    byMonth: Array.from(byMonthMap.entries()).map(([ym, v]) => ({ ym, ...v }))
      .sort((a, b) => a.ym.localeCompare(b.ym)),
    rows,
  };
}
