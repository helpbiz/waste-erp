import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate, parseKstDateStr } from '@/lib/dates';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import { resolveWorkerShiftBadges } from '@/lib/shift-policy';
import AttendanceClient from './_attendance-client';

export const dynamic = 'force-dynamic';

export type ContractorOpt = { id: string; name: string };

function kstHour(d: Date): number {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
}

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string; contractorId?: string } }) {
  const session = (await readSession())!;
  const rawDate = searchParams.date ?? '';
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayKstDate().toISOString().slice(0, 10);
  const date = parseKstDateStr(dateStr);

  /* MUNI_ADMIN 업체 탭 필터 */
  let contractorOpts: ContractorOpt[] = [];
  let pickedContractorId: bigint | null = null;
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), status: { in: ['ACTIVE', 'SETUP'] } },
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    contractorOpts = cs.map((c) => ({ id: c.id.toString(), name: c.companyName }));
    const raw = searchParams.contractorId;
    if (raw && /^\d+$/.test(raw)) {
      const candidate = BigInt(raw);
      if (cs.find((c) => c.id === candidate)) pickedContractorId = candidate;
    }
  }

  /* 가시범위 — MUNI_ADMIN 업체 선택 시 해당 업체만, 미선택 시 산하 전체 */
  const recordScope = pickedContractorId
    ? { contractorId: pickedContractorId }
    : contractorScopeWhere(session);
  const userWhere = pickedContractorId
    ? { contractorId: pickedContractorId }
    : userScope(session);

  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);

  const [records, workers, yesterdayNightRecords] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { workDate: date, ...recordScope },
      include: {
        worker: { select: { id: true, name: true, employeeNo: true, position: { select: { label: true } }, department: { select: { name: true } } } },
        zone: { select: { zoneName: true } },
      },
      orderBy: [{ workType: 'asc' }, { worker: { name: 'asc' } }],
    }),
    prisma.user.findMany({
      where: { role: { in: ['WORKER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] }, status: 'ACTIVE', ...userWhere },
      include: { position: { select: { label: true } }, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    /* 전일 21시대 야간 출근자를 당일 화면에도 이어서 표시하기 위한 조회 — 정확히 하루 전(전일)만 대상,
       전전일 이상은 조회하지 않으므로 자동으로 당일 화면에 노출되지 않는다.
       2026-08-11: checkOutTime 유무와 무관하게 항상 이어보임 대상으로 포함 — 퇴근까지 끝난 순간
       이어보임이 사라져 "출근미등록"으로 오표시되던 문제 수정. 퇴근 완료 여부는 클라이언트에서
       배지로 구분 표시하고(전일출근 vs 퇴근완료), 수정은 항상 전일(실제 workDate) 화면에서만
       하도록 유지 — 이 근로자들의 recordId가 실제로 존재하는 날이 전일이기 때문. */
    prisma.attendanceRecord.findMany({
      where: { workDate: yesterday, ...recordScope, checkInTime: { not: null } },
      select: { id: true, workerId: true, checkInTime: true, checkOutTime: true, checkInStatus: true, checkOutStatus: true },
    }),
  ]);

  /* 조기출근 오판정과 같은 기준(20시 이후 출근 = 야간)으로 전일 근무 이어보임 대상을 선별 */
  const NIGHT_CARRYOVER_HOUR_KST = 20;
  const carryoverMap = new Map(
    yesterdayNightRecords
      .filter((r) => kstHour(r.checkInTime!) >= NIGHT_CARRYOVER_HOUR_KST)
      .map((r) => [r.workerId.toString(), r])
  );

  const shiftBadges = await resolveWorkerShiftBadges(
    workers.map((w) => ({ id: w.id, departmentId: w.departmentId, contractorId: w.contractorId }))
  );

  const recordMap = new Map(records.map((r) => [r.workerId.toString(), r]));
  const rows = workers.map((w) => {
    const r = recordMap.get(w.id.toString());
    const carry = !r ? carryoverMap.get(w.id.toString()) : undefined;
    /* 전일출근 이어보임 행은 실제 전일 근태상태(지각/조퇴/퇴근지연 등)를 그대로 반영 —
       하드코딩된 "정상" 대신 carry 레코드 자신의 checkInStatus/checkOutStatus를 사용 */
    const source = r ?? carry;
    const shiftBadge = shiftBadges.get(w.id.toString()) ?? { shiftType: null, isIndividualOverride: false, departmentShiftType: null };
    return {
      workerId: w.id.toString(),
      workerName: w.name,
      employeeNo: w.employeeNo,
      positionLabel: w.position?.label ?? null,
      departmentName: w.department?.name ?? null,
      recordId: r?.id.toString() ?? null,
      checkInTime: source?.checkInTime?.toISOString() ?? null,
      checkOutTime: source?.checkOutTime?.toISOString() ?? null,
      workType: r?.workType ?? null,
      zoneName: r?.zone?.zoneName ?? null,
      status: r?.status ?? null,
      checkInStatus: (source?.checkInStatus === 'DELAYED' ? null : source?.checkInStatus) ?? null,
      checkOutStatus: (source?.checkOutStatus === 'LATE' ? null : source?.checkOutStatus) ?? null,
      isYesterdayCarryover: !!carry,
      shiftType: shiftBadge.shiftType,
      isShiftIndividualOverride: shiftBadge.isIndividualOverride,
      departmentShiftType: shiftBadge.departmentShiftType,
    };
  });

  /* 통계 — 조퇴 추가 (출근했으나 퇴근 시각이 18시 이전). 전일 야간근무 이어보임 행은 익일 아침 퇴근이
     정상이므로 조퇴 집계에서 제외 */
  const earlyLeaveCutoff = new Date(date);
  earlyLeaveCutoff.setHours(18, 0, 0, 0);
  const summary = {
    total: workers.length,
    checkedIn: rows.filter((r) => r.checkInTime).length,
    checkedOut: rows.filter((r) => r.checkOutTime).length,
    notCheckedIn: rows.filter((r) => !r.checkInTime).length,
    earlyLeave: rows.filter((r) => !r.isYesterdayCarryover && r.checkOutTime && new Date(r.checkOutTime) < earlyLeaveCutoff).length,
    pendingApproval: rows.filter((r) => r.status === 'PENDING').length,
  };

  const adminSelfRecord = (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN')
    ? await prisma.attendanceRecord.findUnique({
        where: { workerId_workDate: { workerId: BigInt(session.userId), workDate: date } },
      })
    : null;

  return (
    <AttendanceClient
      date={dateStr}
      rows={rows}
      summary={summary}
      canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'}
      contractorOpts={contractorOpts}
      selectedContractorId={pickedContractorId?.toString() ?? ''}
      selfRecord={adminSelfRecord ? {
        recordId: adminSelfRecord.id.toString(),
        checkInTime: adminSelfRecord.checkInTime?.toISOString() ?? null,
        checkOutTime: adminSelfRecord.checkOutTime?.toISOString() ?? null,
      } : null}
    />
  );
}
