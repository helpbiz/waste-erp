/**
 * GET /api/attendance/month/[ym]
 * - 월 집계 조회 (위탁업체 단위) — 잠금 상태 + 집계 수치
 * - 권한: 매니저 또는 본인 WORKER (본인만)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { aggregateContractorMonth, isAttendanceManager } from '@/lib/attendance-aggregate';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { ym: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const ym = params.ym;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
    return NextResponse.json({ error: 'invalid_ym' }, { status: 400 });
  }

  /* WORKER 본인 단건 */
  if (session.role === 'WORKER') {
    const sum = await prisma.monthlyAttendanceSummary.findUnique({
      where: { workerId_yearMonth: { workerId: BigInt(session.userId), yearMonth: ym } },
    });
    return NextResponse.json({
      role: session.role,
      yearMonth: ym,
      summary: sum
        ? {
            ...sum,
            id: sum.id.toString(),
            workerId: sum.workerId.toString(),
            finalizedBy: sum.finalizedBy?.toString() ?? null,
          }
        : null,
    });
  }

  if (!isAttendanceManager(session.role) && session.role !== 'MUNI_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* 위탁업체 결정 — P2-2: SUPER_ADMIN/MUNI_ADMIN은 ?contractorId= 필수 */
  let contractorId: bigint | null = null;
  if (session.role === 'SUPER_ADMIN' || session.role === 'MUNI_ADMIN') {
    const cidParam = new URL(req.url).searchParams.get('contractorId');
    if (!cidParam) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    const cid = (() => { try { return BigInt(cidParam); } catch { return null; } })();
    if (!cid) return NextResponse.json({ error: 'invalid_contractor_id' }, { status: 400 });
    if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
      const c = await prisma.contractor.findUnique({ where: { id: cid }, select: { id: true, municipalityId: true } });
      if (!c || c.municipalityId.toString() !== session.municipalityId) {
        return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
      }
    }
    contractorId = cid;
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  const { aggregates, workers } = await aggregateContractorMonth(contractorId, ym);

  /* 기존 저장된 잠금 상태 병합 */
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      yearMonth: ym,
      workerId: { in: workers.map((w) => BigInt(w.id)) },
    },
  });
  const sumByWorker = new Map(summaries.map((s) => [s.workerId.toString(), s]));

  return NextResponse.json({
    role: session.role,
    contractorId: contractorId.toString(),
    yearMonth: ym,
    rows: aggregates.map((agg) => {
      const sum = sumByWorker.get(agg.workerId);
      const w = workers.find((w) => w.id === agg.workerId)!;
      return {
        ...agg,
        workerName: w.name,
        isFinalized: !!sum?.isFinalized,
        finalizedAt: sum?.finalizedAt?.toISOString() ?? null,
        finalizedBy: sum?.finalizedBy?.toString() ?? null,
      };
    }),
  });
}
