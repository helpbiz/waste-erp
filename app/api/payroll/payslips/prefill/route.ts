/**
 * POST /api/payroll/payslips/prefill
 * 근태 마감 집계 → 급여명세서 초안 자동 생성
 *
 * Body: { yearMonth: "2026-05" }
 * - MonthlyAttendanceSummary (마감 완료) 기준으로 workDays/overtimeHours/nightHours 추출
 * - 미발송 상태(isPublished=false)의 PayslipRecord draft를 upsert
 * - 이미 발송(isPublished=true)된 명세서는 덮어쓰지 않음
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { getPayrollPolicy } from '@/lib/payroll-policy';
import { aggregateWorkerMonth } from '@/lib/attendance-aggregate';
import { DEFAULT_TEMPLATE } from '@/lib/payslip-template';

/** payDayLabel("매월 15일") + yearMonth("2026-05") → "2026-05-15" */
function derivePayDate(payDayLabel: string | undefined, yearMonth: string): string | null {
  if (!payDayLabel) return null;
  const m = payDayLabel.match(/(\d{1,2})일/);
  if (!m) return null;
  const day = String(parseInt(m[1])).padStart(2, '0');
  return `${yearMonth}-${day}`;
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isManager = canManageUsers(session.role);
  let workerIsPayrollManager = false;
  if (!isManager && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { isPayrollManager: true },
    });
    workerIsPayrollManager = flag?.isPayrollManager === true;
  }
  if (!isManager && !workerIsPayrollManager) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const yearMonth: string = body?.yearMonth ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return NextResponse.json({ error: 'invalid_yearMonth' }, { status: 400 });
  }

  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN' || session.role === 'MUNI_ADMIN') {
    const c = await prisma.contractor.findFirst({
      where: session.role === 'MUNI_ADMIN' && session.municipalityId
        ? { municipalityId: BigInt(session.municipalityId) }
        : {},
    });
    if (!c) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = c.id;
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  // 이 위탁업체 소속 활성 근로자 ID 목록
  const workerIds = (await prisma.user.findMany({
    where: { role: 'WORKER', status: 'ACTIVE', contractorId },
    select: { id: true },
  })).map((w) => w.id);

  // 마감된 근태 집계 조회 (해당 위탁업체 소속만)
  const mySummaries = await prisma.monthlyAttendanceSummary.findMany({
    where: { yearMonth, isFinalized: true, workerId: { in: workerIds } },
  });

  if (mySummaries.length === 0) {
    return NextResponse.json({ error: 'no_finalized_summaries', message: '마감된 근태 집계가 없습니다.' }, { status: 404 });
  }

  const policy = await getPayrollPolicy(contractorId);

  /* 템플릿에서 payDayLabel 읽어 payDate 자동 계산 */
  const tmplRow = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId, featureKey: 'payslipTemplate' } },
    select: { config: true },
  });
  const tmplConfig = (tmplRow?.config && typeof tmplRow.config === 'object' && !Array.isArray(tmplRow.config))
    ? (tmplRow.config as Record<string, unknown>) : {};
  const payDayLabel = (tmplConfig.payDayLabel as string | undefined) ?? DEFAULT_TEMPLATE.payDayLabel;
  const autoPayDate = derivePayDate(payDayLabel, yearMonth);

  let createdCount = 0;
  let skippedCount = 0;

  for (const s of mySummaries) {
    // 이미 발송된 명세서는 건너뜀
    const existing = await prisma.payslipRecord.findUnique({
      where: { contractorId_workerId_yearMonth: { contractorId, workerId: s.workerId, yearMonth } },
    });
    if (existing?.isPublished) {
      skippedCount++;
      continue;
    }

    // 근태 집계에서 draft 데이터 구성
    const agg = await aggregateWorkerMonth(s.workerId, yearMonth, policy);

    const draftData = {
      workDays: agg.totalWorkDays,
      payDate: autoPayDate,
      hourlyRate: null,
      earnings: {
        기본급: 0,
        주휴수당: 0,
        연장근로수당: 0,
        야간근로수당: 0,
        법정휴일근로수당: 0,
      },
      deductions: {
        근로소득세: 0,
        지방소득세: 0,
        건강보험: 0,
        국민연금: 0,
        고용보험: 0,
      },
      extras: {},
      workHours: {
        overtimeBasic: agg.overtimeHours,
        overtimeExtra: 0,
        nightBasic: agg.nightHours,
        nightExtra: 0,
      },
      totals: {
        임금소계: 0,
        공제소계: 0,
        실지급액: 0,
        총계: 0,
      },
    };

    await prisma.payslipRecord.upsert({
      where: { contractorId_workerId_yearMonth: { contractorId, workerId: s.workerId, yearMonth } },
      create: {
        contractorId,
        workerId: s.workerId,
        yearMonth,
        data: draftData,
        isPublished: false,
        createdBy: BigInt(session.userId),
      },
      update: {
        // 미발송 draft만 업데이트
        data: draftData,
      },
    });
    createdCount++;
  }

  return NextResponse.json({
    message: `${createdCount}명 초안 생성 완료 (${skippedCount}명 발송완료로 건너뜀)`,
    createdCount,
    skippedCount,
  });
}
