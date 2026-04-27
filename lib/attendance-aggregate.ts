/**
 * 월별 근태 집계 — Plan §3-2 B "임금 계산 연계" + §6 P0 "월 마감 확정"
 *
 * MVP 단순 집계 (Phase 1A-3): workType 기반 시간 분배
 * Phase 1A-4 가산임금 자동: 근로기준법 정확 계산 (8시간 초과 ×1.5, 22~06 ×0.5 추가, 휴일 ×1.5)
 * 정책 룰은 추후 정책 테이블 분리 (enterprise-expert 권고)
 */
import { prisma } from '@/lib/db';
import type { Prisma, WorkType } from '@prisma/client';

export type MonthAggregate = {
  workerId: string;
  yearMonth: string;
  totalWorkDays: number;
  totalWorkHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  absenceDays: number;
  /* 룰 적용 전 raw, 룰 엔진은 Phase 1A-4 */
  recordCount: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function ymRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  /* DB의 work_date는 KST 자정에 해당하는 UTC (예: 2026-04-25 KST 00:00 = 2026-04-24 15:00 UTC) */
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

/** 평일 수 (월 ~ 금) — absence 계산용 단순 추정 */
export function weekdayCountInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cnt = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) cnt++;
  }
  return cnt;
}

function hoursBetween(checkIn: Date | null, checkOut: Date | null): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3600000);
}

/** 단일 근로자의 월 집계 */
export async function aggregateWorkerMonth(
  workerId: bigint,
  yearMonth: string
): Promise<MonthAggregate> {
  const { start, end } = ymRange(yearMonth);
  const records = await prisma.attendanceRecord.findMany({
    where: { workerId, workDate: { gte: start, lt: end } },
    orderBy: { workDate: 'asc' },
  });

  let totalWorkHours = 0;
  let overtimeHours = 0;
  let nightHours = 0;
  let holidayHours = 0;
  let workedDays = 0;

  for (const r of records) {
    const h = hoursBetween(r.checkInTime, r.checkOutTime);
    if (r.checkInTime) workedDays++;
    totalWorkHours += h;

    /* MVP 분류 — workType 기반 단순 분배 */
    switch (r.workType as WorkType) {
      case 'EXTENDED':
        overtimeHours += h;
        break;
      case 'NIGHT':
        nightHours += h;
        break;
      case 'HOLIDAY':
        holidayHours += h;
        break;
      default:
        /* 8시간 초과분은 자동으로 overtime 가산 (근로기준법 §56) */
        if (h > 8) overtimeHours += h - 8;
        break;
    }
  }

  const expectedDays = weekdayCountInMonth(yearMonth);
  const absenceDays = Math.max(0, expectedDays - workedDays);

  return {
    workerId: workerId.toString(),
    yearMonth,
    totalWorkDays: workedDays,
    totalWorkHours: Number(totalWorkHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    nightHours: Number(nightHours.toFixed(2)),
    holidayHours: Number(holidayHours.toFixed(2)),
    absenceDays,
    recordCount: records.length,
  };
}

/** 위탁업체 단위 다수 집계 */
export async function aggregateContractorMonth(
  contractorId: bigint,
  yearMonth: string
): Promise<{ aggregates: MonthAggregate[]; workers: { id: string; name: string }[] }> {
  const workers = await prisma.user.findMany({
    where: { role: 'WORKER', status: 'ACTIVE', contractorId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const aggregates: MonthAggregate[] = [];
  for (const w of workers) {
    aggregates.push(await aggregateWorkerMonth(w.id, yearMonth));
  }
  return {
    aggregates,
    workers: workers.map((w) => ({ id: w.id.toString(), name: w.name })),
  };
}

export function isAttendanceManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

/** Prisma upsert input 빌더 */
export function summaryUpsertData(agg: MonthAggregate): Prisma.MonthlyAttendanceSummaryCreateInput {
  return {
    workerId: BigInt(agg.workerId),
    yearMonth: agg.yearMonth,
    totalWorkDays: agg.totalWorkDays,
    totalWorkHours: agg.totalWorkHours,
    overtimeHours: agg.overtimeHours,
    nightHours: agg.nightHours,
    holidayHours: agg.holidayHours,
    absenceDays: agg.absenceDays,
  };
}
