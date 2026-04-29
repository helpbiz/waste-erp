import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import AttendanceClient from './_attendance-client';

export const dynamic = 'force-dynamic';

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string } }) {
  const session = (await readSession())!;
  const dateStr = searchParams.date ?? todayKstDate().toISOString().slice(0, 10);
  const date = new Date(dateStr);

  /* 가시범위 — 사용자 진단 2026-04-29: MUNI_ADMIN 은 본인 지자체 산하만, contractorId=null 폴백 금지 */
  const recordScope = contractorScopeWhere(session);
  const userWhere = userScope(session);

  const [records, workers] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { workDate: date, ...recordScope },
      include: {
        worker: { select: { id: true, name: true, employeeNo: true, position: { select: { label: true } }, department: { select: { name: true } } } },
        zone: { select: { zoneName: true } },
      },
      orderBy: [{ workType: 'asc' }, { worker: { name: 'asc' } }],
    }),
    prisma.user.findMany({
      where: { role: 'WORKER', status: 'ACTIVE', ...userWhere },
      include: { position: { select: { label: true } }, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.workerId.toString(), r]));
  const rows = workers.map((w) => {
    const r = recordMap.get(w.id.toString());
    return {
      workerId: w.id.toString(),
      workerName: w.name,
      employeeNo: w.employeeNo,
      positionLabel: w.position?.label ?? null,
      departmentName: w.department?.name ?? null,
      recordId: r?.id.toString() ?? null,
      checkInTime: r?.checkInTime?.toISOString() ?? null,
      checkOutTime: r?.checkOutTime?.toISOString() ?? null,
      workType: r?.workType ?? null,
      zoneName: r?.zone?.zoneName ?? null,
      status: r?.status ?? null,
    };
  });

  /* 통계 — 조퇴 추가 (출근했으나 퇴근 시각이 18시 이전) */
  const earlyLeaveCutoff = new Date(date);
  earlyLeaveCutoff.setHours(18, 0, 0, 0);
  const summary = {
    total: workers.length,
    checkedIn: rows.filter((r) => r.checkInTime).length,
    checkedOut: rows.filter((r) => r.checkOutTime).length,
    notCheckedIn: rows.filter((r) => !r.checkInTime).length,
    earlyLeave: rows.filter((r) => r.checkOutTime && new Date(r.checkOutTime) < earlyLeaveCutoff).length,
    pendingApproval: rows.filter((r) => r.status === 'PENDING').length,
  };

  return <AttendanceClient date={dateStr} rows={rows} summary={summary} canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'} />;
}
