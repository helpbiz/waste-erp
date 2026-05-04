/**
 * GET /api/dashboard/wall — 풀스크린 관제 모드 데이터.
 *
 * 권한:
 *  - SUPER_ADMIN: 글로벌 (또는 향후 contractorId 쿼리 파라미터 지원)
 *  - CONTRACTOR_ADMIN/INTERNAL_ADMIN: 자기 회사 + nocAccess 활성화 검증
 *  - WORKER: 차단
 *
 * 반환: 메인 대시보드와 동일한 KPI 6종 + 시설별 운영 현황 + 최근 민원.
 *
 * Hot-fix 2026-05-02 — Agent Team 합의(통합 API + scope 자동 적용) 적용.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { complaintWhere, PENDING_STATUSES, complaintTypeLabel } from '@/lib/complaints';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import { todayKstDate } from '@/lib/dates';
import { FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/facility';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'WORKER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  /* 권한: SUPER 외에는 nocAccess 필수 */
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId) {
      return NextResponse.json({ error: 'no_scope' }, { status: 403 });
    }
    const enabled = await hasFeature(session.contractorId, 'nocAccess');
    if (!enabled) return NextResponse.json({ error: 'noc_disabled' }, { status: 403 });
  }

  const cWhere = complaintWhere(session);
  const aWhere = contractorScopeWhere(session);
  const uWhere = userScope(session);
  const today = todayKstDate();
  const todayStart = new Date(`${today.toISOString().slice(0, 10)}T00:00:00+09:00`);

  /* 가시 시설 — contractor 의 지자체 산하 */
  const facilityWhere: { active: boolean; municipalityId?: bigint } = { active: true };
  let contractorName: string | null = null;
  if (session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true, companyName: true },
    });
    if (c?.municipalityId) facilityWhere.municipalityId = c.municipalityId;
    contractorName = c?.companyName ?? null;
  } else if (session.municipalityId) {
    facilityWhere.municipalityId = BigInt(session.municipalityId);
  }

  const [
    pendingCount, overdueCount, todayReceivedCount, todayCompletedCount,
    facilities, totalAssignedUsers, todayCheckIns, totalActiveWorkers,
    recentComplaints,
  ] = await Promise.all([
    prisma.complaint.count({ where: { ...cWhere, status: { in: [...PENDING_STATUSES] } } }),
    prisma.complaint.count({
      where: { ...cWhere, status: { in: [...PENDING_STATUSES] }, dueDate: { lt: new Date() } },
    }),
    prisma.complaint.count({ where: { ...cWhere, reportedAt: { gte: todayStart } } }),
    prisma.complaint.count({
      where: { ...cWhere, status: 'COMPLETED', resolvedAt: { gte: todayStart } },
    }),
    prisma.wasteTreatmentFacility.findMany({
      where: facilityWhere,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        primaryUsers: { where: uWhere, select: { id: true } },
        attendances: {
          where: { workDate: today, checkInTime: { not: null } },
          select: { id: true },
        },
      },
    }),
    prisma.user.count({ where: { ...uWhere, primaryFacilityId: { not: null } } }),
    prisma.attendanceRecord.count({
      where: { ...aWhere, workDate: today, checkInTime: { not: null } },
    }),
    prisma.user.count({ where: { ...uWhere, role: 'WORKER', status: 'ACTIVE' } }),
    prisma.complaint.findMany({
      where: cWhere,
      orderBy: { reportedAt: 'desc' },
      take: 8,
      select: {
        id: true, type: true, status: true, reportedAt: true,
      },
    }),
  ]);

  const avacCount = facilities.filter((f) => f.type === 'AVAC').length;
  const attendanceRate = totalActiveWorkers > 0
    ? Math.round((todayCheckIns / totalActiveWorkers) * 100) : 0;

  return NextResponse.json({
    contractorName,
    complaints: {
      pending: pendingCount,
      overdue: overdueCount,
      todayReceived: todayReceivedCount,
      todayCompleted: todayCompletedCount,
    },
    ops: {
      facilityCount: facilities.length,
      avacCount,
      assignedUsers: totalAssignedUsers,
      totalActiveWorkers,
      todayCheckIns,
      attendanceRate,
    },
    facilities: facilities.map((f) => {
      const userCount = f.primaryUsers.length;
      const todayPresent = f.attendances.length;
      const presentRate = userCount > 0 ? Math.round((todayPresent / userCount) * 100) : 0;
      return {
        id: f.id.toString(),
        name: f.name,
        type: f.type,
        userCount,
        todayPresent,
        presentRate,
      };
    }),
    recentComplaints: recentComplaints.map((c) => ({
      id: c.id.toString(),
      type: complaintTypeLabel(c.type),
      status: c.status,
      reportedAt: new Date(c.reportedAt.getTime() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' '),
      completed: c.status === 'COMPLETED',
    })),
  });
}
