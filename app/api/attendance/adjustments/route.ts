/**
 * GET /api/attendance/adjustments?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&contractorId=]
 * 정정 이력 통합 조회 — 날짜 범위의 모든 AttendanceAdjustment를 반환
 * 권한: 관리자만 (SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN, MUNI_ADMIN)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const contractorIdParam = url.searchParams.get('contractorId');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  /* 업체 범위 결정 */
  let contractorIds: bigint[] | null = null;

  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ adjustments: [] });
    contractorIds = [BigInt(session.contractorId)];
  } else if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ adjustments: [] });
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), deletedAt: null },
      select: { id: true },
    });
    contractorIds = cs.map((c) => c.id);
    if (contractorIds.length === 0) return NextResponse.json({ adjustments: [] });
    /* MUNI_ADMIN도 특정 업체로 필터링 가능 */
    if (contractorIdParam) {
      const filtered = contractorIds.filter((id) => id.toString() === contractorIdParam);
      if (filtered.length > 0) contractorIds = filtered;
    }
  } else if (session.role === 'SUPER_ADMIN' && contractorIdParam) {
    contractorIds = [BigInt(contractorIdParam)];
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  const adjustments = await prisma.attendanceAdjustment.findMany({
    where: {
      record: {
        workDate: { gte: start, lte: end },
        ...(contractorIds ? { contractorId: { in: contractorIds } } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      record: {
        select: {
          workDate: true,
          worker: { select: { name: true, employeeNo: true } },
        },
      },
    },
    take: 500,
  });

  /* 정정자 이름 일괄 조회 */
  const adjusterIds = [...new Set(adjustments.map((a) => a.adjustedBy))];
  const adjusters = await prisma.user.findMany({
    where: { id: { in: adjusterIds } },
    select: { id: true, name: true },
  });
  const adjusterMap = new Map(adjusters.map((u) => [u.id.toString(), u.name]));

  return NextResponse.json({
    total: adjustments.length,
    adjustments: adjustments.map((a) => ({
      id: a.id.toString(),
      recordId: a.recordId.toString(),
      workDate: a.record.workDate.toISOString().slice(0, 10),
      workerName: a.record.worker.name,
      employeeNo: a.record.worker.employeeNo ?? null,
      adjustmentType: a.adjustmentType,
      reason: a.reason,
      original: {
        checkIn: a.originalCheckIn?.toISOString() ?? null,
        checkOut: a.originalCheckOut?.toISOString() ?? null,
        workType: a.originalWorkType ?? null,
      },
      adjusted: {
        checkIn: a.adjustedCheckIn?.toISOString() ?? null,
        checkOut: a.adjustedCheckOut?.toISOString() ?? null,
        workType: a.adjustedWorkType ?? null,
      },
      adjustedByName: adjusterMap.get(a.adjustedBy.toString()) ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
