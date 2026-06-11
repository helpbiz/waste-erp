/**
 * 월별 근태 집계 — Plan §3-2 B "임금 계산 연계" + §6 P0 "월 마감 확정"
 *
 * Phase 1A-4: PayrollPolicy 기반 clock_in/out → 야간/연장 자동 계산
 * - NORMAL/EXTENDED: clock 시간으로 야간 구간 자동 산출 (22:00~06:00 등 설정 값 적용)
 * - NIGHT: workType 수동 지정도 계속 지원
 * - 연장: 1일 기본근무시간(dailyWorkHours) 초과분 자동 가산
 */
import { prisma } from '@/lib/db';
import type { Prisma, WorkType } from '@prisma/client';
import { calcNightHours, DEFAULT_POLICY, type PayrollPolicyData } from '@/lib/payroll-policy';

export type MonthAggregate = {
  workerId: string;
  yearMonth: string;
  totalWorkDays: number;
  totalWorkHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  absenceDays: number;
  recordCount: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function ymRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

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

/** 단일 근로자의 월 집계 (정책 기반 야간/연장 자동 계산) */
export async function aggregateWorkerMonth(
  workerId: bigint,
  yearMonth: string,
  policy: PayrollPolicyData = DEFAULT_POLICY
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

    switch (r.workType as WorkType) {
      case 'HOLIDAY':
        holidayHours += h;
        // 휴일근무도 야간 구간 포함 여부 체크
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(
            r.checkInTime, r.checkOutTime,
            policy.nightStartHour, policy.nightEndHour
          );
        }
        break;

      case 'NIGHT':
        // 수동 야간 지정: clock 기반으로 재계산 (더 정확)
        if (r.checkInTime && r.checkOutTime) {
          const autoNight = calcNightHours(
            r.checkInTime, r.checkOutTime,
            policy.nightStartHour, policy.nightEndHour
          );
          nightHours += autoNight > 0 ? autoNight : h;
        } else {
          nightHours += h;
        }
        // 야간근무 중 dailyWorkHours 초과도 연장으로 처리
        if (h > policy.dailyWorkHours) {
          overtimeHours += h - policy.dailyWorkHours;
        }
        break;

      case 'EXTENDED':
        overtimeHours += h;
        // 연장근무 중에도 야간 구간 자동 계산
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(
            r.checkInTime, r.checkOutTime,
            policy.nightStartHour, policy.nightEndHour
          );
        }
        break;

      default: // NORMAL
        // 일일 기본근무시간 초과 → 연장
        if (h > policy.dailyWorkHours) {
          overtimeHours += h - policy.dailyWorkHours;
        }
        // clock 기반 야간 자동 산출
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(
            r.checkInTime, r.checkOutTime,
            policy.nightStartHour, policy.nightEndHour
          );
        }
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

/** 위탁업체 단위 다수 집계 — P3-3: N+1 → 2-query 배치 */
export async function aggregateContractorMonth(
  contractorId: bigint,
  yearMonth: string,
  policy: PayrollPolicyData = DEFAULT_POLICY
): Promise<{ aggregates: MonthAggregate[]; workers: { id: string; name: string }[] }> {
  const { start, end } = ymRange(yearMonth);

  /* 쿼리 1: 활성 근로자 목록 */
  const workers = await prisma.user.findMany({
    where: { role: 'WORKER', status: 'ACTIVE', contractorId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (workers.length === 0) return { aggregates: [], workers: [] };

  /* 쿼리 2: 해당 월 전체 근태 레코드를 한 번에 조회 */
  const allRecords = await prisma.attendanceRecord.findMany({
    where: {
      workerId: { in: workers.map((w) => w.id) },
      workDate: { gte: start, lt: end },
    },
    orderBy: { workDate: 'asc' },
  });

  /* 근로자별 그룹핑 */
  const recordsByWorker = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    const key = r.workerId.toString();
    const arr = recordsByWorker.get(key) ?? [];
    arr.push(r);
    recordsByWorker.set(key, arr);
  }

  /* 메모리 내 집계 (DB 호출 없음) */
  const aggregates: MonthAggregate[] = workers.map((w) => {
    const records = recordsByWorker.get(w.id.toString()) ?? [];
    return computeAggregate(w.id, yearMonth, records, policy);
  });

  return {
    aggregates,
    workers: workers.map((w) => ({ id: w.id.toString(), name: w.name })),
  };
}

/** records가 이미 로드된 경우 DB 호출 없이 집계 계산 */
function computeAggregate(
  workerId: bigint,
  yearMonth: string,
  records: Awaited<ReturnType<typeof prisma.attendanceRecord.findMany>>,
  policy: PayrollPolicyData
): MonthAggregate {
  let totalWorkHours = 0;
  let overtimeHours = 0;
  let nightHours = 0;
  let holidayHours = 0;
  let workedDays = 0;

  for (const r of records) {
    const h = hoursBetween(r.checkInTime, r.checkOutTime);
    if (r.checkInTime) workedDays++;
    totalWorkHours += h;

    switch (r.workType as WorkType) {
      case 'HOLIDAY':
        holidayHours += h;
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(r.checkInTime, r.checkOutTime, policy.nightStartHour, policy.nightEndHour);
        }
        break;
      case 'NIGHT':
        if (r.checkInTime && r.checkOutTime) {
          const autoNight = calcNightHours(r.checkInTime, r.checkOutTime, policy.nightStartHour, policy.nightEndHour);
          nightHours += autoNight > 0 ? autoNight : h;
        } else {
          nightHours += h;
        }
        if (h > policy.dailyWorkHours) overtimeHours += h - policy.dailyWorkHours;
        break;
      case 'EXTENDED':
        overtimeHours += h;
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(r.checkInTime, r.checkOutTime, policy.nightStartHour, policy.nightEndHour);
        }
        break;
      default: // NORMAL
        if (h > policy.dailyWorkHours) overtimeHours += h - policy.dailyWorkHours;
        if (r.checkInTime && r.checkOutTime) {
          nightHours += calcNightHours(r.checkInTime, r.checkOutTime, policy.nightStartHour, policy.nightEndHour);
        }
        break;
    }
  }

  const expectedDays = weekdayCountInMonth(yearMonth);
  return {
    workerId: workerId.toString(),
    yearMonth,
    totalWorkDays: workedDays,
    totalWorkHours: Number(totalWorkHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    nightHours: Number(nightHours.toFixed(2)),
    holidayHours: Number(holidayHours.toFixed(2)),
    absenceDays: Math.max(0, expectedDays - workedDays),
    recordCount: records.length,
  };
}

export function isAttendanceManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

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
