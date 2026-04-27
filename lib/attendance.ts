/**
 * 근태 조회 — Plan §3-1 권한별 가시 범위 + §7-1 지자체 GET-only 부합
 *
 * - WORKER             : 본인 데이터만
 * - INTERNAL_ADMIN     : 본인 위탁업체 전체
 * - CONTRACTOR_ADMIN   : 본인 위탁업체 전체
 * - MUNI_ADMIN         : 본인 지자체 산하 위탁업체 전체 (read-only)
 * - SUPER_ADMIN        : 전체
 */
import { prisma } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';
import { todayKstDate, isLateCheckIn } from '@/lib/dates';

export type AttendanceCard = {
  id: string;
  workerId: string;
  workerName: string;
  zoneName: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  workType: string;
  status: string;
  isLate: boolean;
};

export type AttendanceSummary = {
  totalWorkers: number;
  checkedIn: number;
  late: number;
  absent: number;
  needAdjust: number;
};

function workerWhereForSession(session: SessionPayload) {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.contractorId) {
    return { contractorId: BigInt(session.contractorId) };
  }
  return { id: -1n }; // 안전 fallback (no match)
}

/** 오늘 시점의 가시 범위 내 근로자 목록 + 출퇴근 기록 */
export async function getTodayAttendance(session: SessionPayload) {
  const today = todayKstDate();
  const userWhere = workerWhereForSession(session);

  /* WORKER 본인 단건 */
  if (session.role === 'WORKER') {
    const me = await prisma.attendanceRecord.findUnique({
      where: { workerId_workDate: { workerId: BigInt(session.userId), workDate: today } },
      include: { worker: true, zone: true },
    });
    return { isWorker: true, today, me };
  }

  /* 관리자 — 가시 범위의 근로자 + 오늘 기록을 조인 */
  const workers = await prisma.user.findMany({
    where: { ...userWhere, role: 'WORKER', status: 'ACTIVE' },
    select: { id: true, name: true, contractorId: true },
    orderBy: { id: 'asc' },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      workDate: today,
      workerId: { in: workers.map((w) => w.id) },
    },
    include: { zone: { select: { zoneName: true } } },
  });

  const byWorker = new Map<bigint, (typeof records)[number]>();
  for (const r of records) byWorker.set(r.workerId, r);

  const cards: AttendanceCard[] = workers.map((w) => {
    const r = byWorker.get(w.id);
    return {
      id: r ? r.id.toString() : `noatt-${w.id.toString()}`,
      workerId: w.id.toString(),
      workerName: w.name,
      zoneName: r?.zone?.zoneName ?? null,
      checkInTime: r?.checkInTime?.toISOString() ?? null,
      checkOutTime: r?.checkOutTime?.toISOString() ?? null,
      workType: r?.workType ?? 'NORMAL',
      status: r?.status ?? 'PENDING',
      isLate: r?.checkInTime ? isLateCheckIn(r.checkInTime) : false,
    };
  });

  const summary: AttendanceSummary = {
    totalWorkers: workers.length,
    checkedIn: cards.filter((c) => c.checkInTime && c.workType !== 'NIGHT').length, // 단순 카운트
    late: cards.filter((c) => c.checkInTime && c.isLate).length,
    absent: cards.filter((c) => !c.checkInTime).length,
    needAdjust: cards.filter((c) => c.status === 'PENDING' || c.status === 'ADJUSTED').length,
  };

  return { isWorker: false, today, cards, summary };
}
