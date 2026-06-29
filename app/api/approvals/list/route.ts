import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageUsers, userScope } from '@/lib/users';
import { safetyWhere } from '@/lib/safety';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { contractorScopeWhere } from '@/lib/scopes';

export const dynamic = 'force-dynamic';

export type ApprovalItem = {
  kind: 'leave' | 'attendance' | 'vehicleLog' | 'safety';
  id: string;
  personName: string;
  departmentName: string | null;
  summary: string;
  detail: string | null;
  status: string;
  createdAt: string;
  routeDetail?: string | null;
  startMileage?: number | null;
  endMileage?: number | null;
  fuelUsed?: number | null;
  tripCount?: number | null;
  // safety-specific
  checklistItems?: Array<{ key: string; label: string; ok: boolean }> | null;
  allChecked?: boolean;
  severity?: string;
  locationAddress?: string | null;
  reportType?: string;
};

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'pending';
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();

  const aWhere = contractorScopeWhere(session);
  const vlWhere = vehicleLogWhere(session);
  const sWhere = safetyWhere(session);
  /* userScope 사용 — INTERNAL_ADMIN(contractorId 없음) 이 전체 목록을 보던 버그 수정 */
  const leaveScope = userScope(session);
  const leaveBase = Object.keys(leaveScope).length > 0 ? { worker: leaveScope } : {};

  /* status filters per tab */
  const leaveStatuses = tab === 'pending'
    ? ['PENDING', 'IN_REVIEW']
    : tab === 'approved' ? ['APPROVED']
    : tab === 'rejected' ? ['REJECTED']
    : ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'];

  const attendanceStatuses = tab === 'pending'
    ? ['PENDING']
    : tab === 'approved' ? ['APPROVED']
    : tab === 'rejected' ? ['REJECTED']
    : ['PENDING', 'APPROVED', 'REJECTED'];

  // VehicleLog: DRAFT | SUBMITTED | APPROVED (반려 시 DRAFT로 복귀, REJECTED 없음)
  const vehicleStatuses = tab === 'pending'
    ? ['SUBMITTED']
    : tab === 'approved' ? ['APPROVED']
    : tab === 'rejected' ? ['DRAFT']   // 반려된 일지는 DRAFT로 복귀
    : ['DRAFT', 'SUBMITTED', 'APPROVED'];

  // SafetyReportStatus: SUBMITTED | REVIEWED | MOL_REPORTED | RESOLVED
  const safetyStatuses = tab === 'pending'
    ? ['SUBMITTED']
    : tab === 'approved' ? ['REVIEWED', 'MOL_REPORTED', 'RESOLVED']
    : tab === 'rejected' ? []   // 안전보고서는 반려 없음
    : ['SUBMITTED', 'REVIEWED', 'MOL_REPORTED', 'RESOLVED'];

  const SAFETY_TYPE_LABEL: Record<string, string> = {
    DAILY_CHECKLIST: '일일 안전점검',
    NEAR_MISS: '아차사고',
    INCIDENT: '재해 발생',
    TBM_SIGNATURE: 'TBM 서명',
  };

  const LEAVE_TYPE: Record<string, string> = {
    ANNUAL: '연차', ANNUAL_HALF: '연차(반차)', SPECIAL: '경조사', MATERNITY: '출산',
    FAMILY_CARE: '가족돌봄', MENSTRUAL: '생리', OFFICIAL: '공가',
    SICK: '병가', BUSINESS_TRIP: '출장', TRAINING: '교육', OTHER: '기타',
  };

  const [leaveRows, attendanceRows, vehicleLogRows, safetyRows] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { ...leaveBase, status: { in: leaveStatuses as never[] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { worker: { select: { name: true, department: { select: { name: true } } } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { ...aWhere, status: { in: attendanceStatuses as never[] } },
      orderBy: { workDate: 'desc' },
      take: 200,
      include: { worker: { select: { name: true, department: { select: { name: true } } } } },
    }),
    prisma.vehicleLog.findMany({
      where: { ...vlWhere, status: { in: vehicleStatuses as never[] } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        driver: { select: { name: true } },
        vehicle: { select: { vehicleNo: true } },
      },
    }),
    prisma.safetyReport.findMany({
      where: { ...sWhere, status: { in: safetyStatuses as never[] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { reporter: { select: { name: true } } },
    }),
  ]);

  const items: ApprovalItem[] = [
    ...leaveRows.map((r) => ({
      kind: 'leave' as const,
      id: r.id.toString(),
      personName: r.worker.name,
      departmentName: r.worker.department?.name ?? null,
      summary: `휴가 신청 — ${LEAVE_TYPE[r.requestType] ?? r.requestType} (${r.startDate.toISOString().slice(0, 10)} ~ ${r.endDate.toISOString().slice(0, 10)})`,
      detail: r.reason ?? null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...attendanceRows.map((r) => ({
      kind: 'attendance' as const,
      id: r.id.toString(),
      personName: r.worker.name,
      departmentName: r.worker.department?.name ?? null,
      summary: `근태 조정 — ${r.workDate.toISOString().slice(0, 10)}`,
      detail: r.checkInTime ? `출근 ${fmtTime(r.checkInTime)}` + (r.checkOutTime ? ` · 퇴근 ${fmtTime(r.checkOutTime)}` : '') : null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...vehicleLogRows.map((r) => ({
      kind: 'vehicleLog' as const,
      id: r.id.toString(),
      personName: r.driver.name,
      departmentName: null,
      summary: `운행일지 — ${r.vehicle.vehicleNo} · ${r.logDate.toISOString().slice(0, 10)}`,
      detail: [
        r.tripCount != null ? `${r.tripCount}회 운행` : null,
        r.startMileage != null && r.endMileage != null ? `주행 ${r.endMileage - r.startMileage}km` : null,
        r.fuelUsed != null ? `주유 ${r.fuelUsed}L` : null,
      ].filter(Boolean).join(' · ') || null,
      routeDetail: r.routeDetail ?? null,
      startMileage: r.startMileage,
      endMileage: r.endMileage,
      fuelUsed: r.fuelUsed != null ? Number(r.fuelUsed) : null,
      tripCount: r.tripCount,
      status: r.status,
      createdAt: r.updatedAt.toISOString(),
    })),
    ...safetyRows.map((r) => ({
      kind: 'safety' as const,
      id: r.id.toString(),
      personName: r.reporter?.name ?? '—',
      departmentName: null,
      summary: `안전보고서 — ${SAFETY_TYPE_LABEL[r.reportType] ?? r.reportType} (${r.reportDate.toISOString().slice(0, 10)})`,
      detail: r.description ?? null,
      checklistItems: r.checklistItems as Array<{ key: string; label: string; ok: boolean }> | null,
      allChecked: r.allChecked,
      severity: r.severity,
      locationAddress: r.locationAddress ?? null,
      reportType: r.reportType,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  ];

  /* sort by createdAt desc and apply name search */
  const filtered = items
    .filter((i) => !search || i.personName.toLowerCase().includes(search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ items: filtered });
}

function fmtTime(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}
