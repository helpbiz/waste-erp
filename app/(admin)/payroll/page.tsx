import { readSession } from '@/lib/auth';
import { aggregateContractorMonth, isAttendanceManager } from '@/lib/attendance-aggregate';
import { prisma } from '@/lib/db';
import { requireFeature } from '@/lib/feature-guard';
import { getPayrollPolicy, type PayrollPolicyData } from '@/lib/payroll-policy';
import PayrollClient, { type Row } from './_payroll-client';

export const dynamic = 'force-dynamic';

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const session = (await readSession())!;

  /* 급여관리 권한: 관리자 역할 또는 isPayrollManager 플래그 */
  const isManagerRole = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role);
  let workerIsPayrollManager = false;
  if (!isManagerRole && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { isPayrollManager: true },
    });
    workerIsPayrollManager = flag?.isPayrollManager === true;
    if (!workerIsPayrollManager) {
      return (
        <div className="bg-red-50 border border-red-300 border-l-4 border-l-red-500 rounded-md px-5 py-4 text-sm font-bold text-red-900">
          급여관리 접근 권한이 없습니다.
        </div>
      );
    }
  }

  /* 회사별 기능 권한 — costCalculation OFF 면 안내 페이지로 */
  await requireFeature(session, 'costCalculation');

  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.ym ?? '')
    ? searchParams.ym!
    : defaultYearMonth();

  let contractorId: bigint | null = null;
  if (session.role === 'SUPER_ADMIN' || session.role === 'MUNI_ADMIN') {
    const c = await prisma.contractor.findFirst({
      where: session.role === 'MUNI_ADMIN' && session.municipalityId
        ? { municipalityId: BigInt(session.municipalityId) }
        : {},
    });
    if (c) contractorId = c.id;
  } else if (session.contractorId) {
    contractorId = BigInt(session.contractorId);
  }

  if (!contractorId) {
    return (
      <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-5 py-4 text-sm font-bold text-amber-900">
        가시 범위 내 위탁업체가 없습니다.
      </div>
    );
  }

  const policy = await getPayrollPolicy(contractorId);

  /* 결재승인권자 이름 조회 */
  let approverName: string | null = null;
  if (policy.payslipApproverId) {
    const approver = await prisma.user.findUnique({
      where: { id: BigInt(policy.payslipApproverId) },
      select: { name: true },
    });
    approverName = approver?.name ?? null;
  }
  const approverInfo = {
    approverId:           policy.payslipApproverId,
    approverName,
    isCurrentUserApprover: policy.payslipApproverId === session.userId,
  };

  const { aggregates, workers } = await aggregateContractorMonth(contractorId, ym, policy);
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: { yearMonth: ym, workerId: { in: workers.map((w) => BigInt(w.id)) } },
  });
  const sumMap = new Map(summaries.map((s) => [s.workerId.toString(), s]));

  /* finalizedBy 사용자 이름 미리 조회 */
  const finalizerIds = Array.from(
    new Set(summaries.map((s) => s.finalizedBy?.toString()).filter(Boolean) as string[])
  );
  const finalizers = await prisma.user.findMany({
    where: { id: { in: finalizerIds.map((id) => BigInt(id)) } },
    select: { id: true, name: true },
  });
  const fnMap = new Map(finalizers.map((f) => [f.id.toString(), f.name]));

  const rows: Row[] = aggregates.map((agg) => {
    const sum = sumMap.get(agg.workerId);
    const w = workers.find((w) => w.id === agg.workerId)!;
    return {
      workerId: agg.workerId,
      workerName: w.name,
      totalWorkDays: agg.totalWorkDays,
      totalWorkHours: agg.totalWorkHours,
      overtimeHours: agg.overtimeHours,
      nightHours: agg.nightHours,
      holidayHours: agg.holidayHours,
      absenceDays: agg.absenceDays,
      isFinalized: !!sum?.isFinalized,
      finalizedAt: sum?.finalizedAt?.toISOString() ?? null,
      finalizedByName: sum?.finalizedBy ? fnMap.get(sum.finalizedBy.toString()) ?? null : null,
    };
  });

  const finalizedCount = rows.filter((r) => r.isFinalized).length;
  const isManager = isAttendanceManager(session.role) || workerIsPayrollManager;
  /* canUnlock: SUPER_ADMIN은 전체/개별 모두, CONTRACTOR_ADMIN/INTERNAL_ADMIN은 개별만 */
  const canUnlock = isManager;

  return (
    <PayrollClient
      ym={ym}
      rows={rows}
      finalizedCount={finalizedCount}
      isManager={isManager}
      canUnlock={canUnlock}
      policy={policy}
      approverInfo={approverInfo}
    />
  );
}
