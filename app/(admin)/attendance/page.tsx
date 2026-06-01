import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import AttendanceClient from './_attendance-client';

export const dynamic = 'force-dynamic';

export type ContractorOpt = { id: string; name: string };

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string; contractorId?: string } }) {
  const session = (await readSession())!;
  const rawDate = searchParams.date ?? '';
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayKstDate().toISOString().slice(0, 10);
  const date = new Date(dateStr + 'T00:00:00');

  /* MUNI_ADMIN 업체 탭 필터 */
  let contractorOpts: ContractorOpt[] = [];
  let pickedContractorId: bigint | null = null;
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), status: 'ACTIVE' },
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
      where: { role: { in: ['WORKER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] }, status: 'ACTIVE', ...userWhere },
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

  const adminSelfRecord = (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN')
    ? await prisma.attendanceRecord.findUnique({
        where: { workerId_workDate: { workerId: BigInt(session.userId), workDate: new Date(dateStr + 'T00:00:00') } },
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
