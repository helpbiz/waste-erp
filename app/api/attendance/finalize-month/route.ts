/**
 * POST /api/attendance/finalize-month
 * - 월별 근태 집계 → MonthlyAttendanceSummary 저장 + isFinalized=true (잠금)
 * - 권한: SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN (매니저)
 * - 잠금 후: AttendanceRecord 조정은 month_finalized 409 (adjust API에서 검증)
 * - 마감된 월의 재마감 시도는 409
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import {
  aggregateWorkerMonth,
  isAttendanceManager,
  summaryUpsertData,
} from '@/lib/attendance-aggregate';

export const runtime = 'nodejs';

const Body = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'yearMonth must be YYYY-MM'),
  workerIds: z.array(z.union([z.string(), z.number()])).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  let allowed = isAttendanceManager(session.role);
  if (!allowed && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isPayrollManager: true } });
    allowed = flag?.isPayrollManager === true;
  }
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { yearMonth, workerIds } = parsed.data;

  /* 가시범위 + 근로자 결정 */
  const where: { role: 'WORKER'; status: 'ACTIVE'; contractorId?: bigint; id?: { in: bigint[] } } = {
    role: 'WORKER',
    status: 'ACTIVE',
  };
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    where.contractorId = BigInt(session.contractorId);
  }
  if (workerIds && workerIds.length > 0) {
    where.id = { in: workerIds.map((id) => BigInt(id)) };
  }
  const workers = await prisma.user.findMany({ where, select: { id: true, name: true } });
  if (workers.length === 0) {
    return NextResponse.json({ error: 'no_workers_in_scope' }, { status: 400 });
  }

  /* 이미 마감된 행이 있으면 409 — 재마감 차단 (해제 후 재마감은 별도 endpoint) */
  const alreadyFinalized = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      yearMonth,
      workerId: { in: workers.map((w) => w.id) },
      isFinalized: true,
    },
    select: { workerId: true },
  });
  if (alreadyFinalized.length > 0) {
    return NextResponse.json(
      {
        error: 'already_finalized',
        finalizedWorkerIds: alreadyFinalized.map((f) => f.workerId.toString()),
      },
      { status: 409 }
    );
  }

  const finalizedAt = new Date();
  const finalizedBy = BigInt(session.userId);

  /* P0-4: 집계(읽기)는 병렬 선행, 쓰기(upsert 전체)는 단일 $transaction으로 묶어 부분 마감 방지 */
  const aggregations = await Promise.all(
    workers.map(async (w) => ({
      worker: w,
      agg: await aggregateWorkerMonth(w.id, yearMonth),
    }))
  );

  const summaries = await prisma.$transaction(
    aggregations.map(({ worker, agg }) => {
      const data = summaryUpsertData(agg);
      return prisma.monthlyAttendanceSummary.upsert({
        where: { workerId_yearMonth: { workerId: worker.id, yearMonth } },
        update: { ...data, isFinalized: true, finalizedAt, finalizedBy },
        create: { ...data, isFinalized: true, finalizedAt, finalizedBy },
      });
    })
  );

  const results = aggregations.map(({ worker, agg }, i) => ({
    workerId: worker.id.toString(),
    workerName: worker.name,
    summaryId: summaries[i].id.toString(),
    totals: agg,
  }));

  await prisma.auditLog.create({
    data: {
      actorId: finalizedBy,
      actorRole: session.role,
      action: 'ATTENDANCE_MONTH_FINALIZE',
      resourceType: 'monthly_attendance_summary',
      resourceId: yearMonth,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        yearMonth,
        workerCount: results.length,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    yearMonth,
    finalizedAt: finalizedAt.toISOString(),
    finalizedBy: finalizedBy.toString(),
    workerCount: results.length,
    results,
  });
}
