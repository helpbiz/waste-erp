/**
 * GET /api/attendance/stale
 * - 퇴근 미마감(checkOutTime null) 상태로 방치된 과거 근태 기록 조회
 * - 관리자용 "빠른 마감" 화면에서 사용 — 근로자 출퇴근 화면은 정확히 하루 전(-24h)만
 *   찾아 이어보이므로, 그보다 오래 방치된 기록은 근로자 스스로 못 닫고 관리자 개입이 필요함
 * - 권한: SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageOperations } from '@/lib/rbac';
import { contractorScopeWhere } from '@/lib/scopes';
import { todayKstDate } from '@/lib/dates';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const today = todayKstDate();

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...contractorScopeWhere(session),
      workDate: { lt: today },
      checkInTime: { not: null },
      checkOutTime: null,
    },
    include: {
      worker: { select: { id: true, name: true, employeeNo: true } },
    },
    orderBy: { workDate: 'asc' },
    take: 200,
  });

  return NextResponse.json({
    items: records.map((r) => ({
      id: r.id.toString(),
      workDate: r.workDate.toISOString().slice(0, 10),
      workerName: r.worker.name,
      employeeNo: r.worker.employeeNo,
      checkInTime: r.checkInTime?.toISOString() ?? null,
      daysStale: Math.round((today.getTime() - r.workDate.getTime()) / (24 * 60 * 60 * 1000)),
    })),
  });
}
