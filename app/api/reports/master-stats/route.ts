/**
 * GET /api/reports/master-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *  - 모든 영역 통합 통계 (인사/근태/휴가/민원/차량/실적/반입/안전)
 *  - 가시범위(contractor) 적용
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function contractorScope<T extends { contractorId?: bigint | { equals?: bigint } | null }>(
  session: { role: string; contractorId: string | null; municipalityId: string | null }
): Record<string, unknown> {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') ?? new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const cWhere = contractorScope(session) as Prisma.UserWhereInput;
  const userScopeWhere = cWhere as Prisma.UserWhereInput;

  /* ──────── 인사 ──────── */
  const [users, byRole, byPosition, byDept] = await Promise.all([
    prisma.user.count({ where: userScopeWhere }),
    prisma.user.groupBy({ by: ['role'], _count: true, where: userScopeWhere }),
    prisma.user.findMany({
      where: userScopeWhere,
      select: { position: { select: { code: true, label: true, category: true } } },
    }),
    prisma.user.findMany({
      where: userScopeWhere,
      select: { department: { select: { name: true } } },
    }),
  ]);
  const positionMap = new Map<string, { label: string; count: number; category: string }>();
  for (const u of byPosition) {
    if (!u.position) continue;
    const k = u.position.code;
    const cur = positionMap.get(k) ?? { label: u.position.label, count: 0, category: u.position.category };
    cur.count++;
    positionMap.set(k, cur);
  }
  const deptMap = new Map<string, number>();
  for (const u of byDept) {
    const n = u.department?.name ?? '미지정';
    deptMap.set(n, (deptMap.get(n) ?? 0) + 1);
  }

  /* ──────── 근태 ──────── */
  const attendanceWhere: Prisma.AttendanceRecordWhereInput = {
    workDate: { gte: fromDate, lte: toDate },
    ...(cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {}),
  };
  const [attTotal, attendances] = await Promise.all([
    prisma.attendanceRecord.count({ where: attendanceWhere }),
    prisma.attendanceRecord.findMany({
      where: attendanceWhere,
      select: { workDate: true, checkInTime: true, checkOutTime: true, workType: true, status: true },
    }),
  ]);
  const attDailyMap = new Map<string, number>();
  let earlyLeaves = 0;
  for (const a of attendances) {
    const k = a.workDate.toISOString().slice(0, 10);
    if (a.checkInTime) attDailyMap.set(k, (attDailyMap.get(k) ?? 0) + 1);
    if (a.checkOutTime) {
      const cutoff = new Date(a.workDate);
      cutoff.setHours(18, 0, 0, 0);
      if (new Date(a.checkOutTime) < cutoff) earlyLeaves++;
    }
  }

  /* ──────── 휴가 ──────── */
  const leaveWhere: Prisma.LeaveRequestWhereInput = {
    AND: [{ startDate: { lte: toDate } }, { endDate: { gte: fromDate } }],
    worker: cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : undefined,
  };
  const leaveItems = await prisma.leaveRequest.findMany({ where: leaveWhere });
  const leaveByType = new Map<string, number>();
  let leaveApproved = 0, leavePending = 0, leaveInReview = 0, leaveRejected = 0;
  let leaveDays = 0;
  for (const l of leaveItems) {
    leaveByType.set(l.requestType, (leaveByType.get(l.requestType) ?? 0) + 1);
    if (l.status === 'APPROVED') {
      leaveApproved++;
      const days = l.requestType === 'ANNUAL_HALF' ? 0.5 :
        Math.max(1, Math.floor((l.endDate.getTime() - l.startDate.getTime()) / 86_400_000) + 1);
      leaveDays += days;
    } else if (l.status === 'PENDING') leavePending++;
    else if (l.status === 'IN_REVIEW') leaveInReview++;
    else if (l.status === 'REJECTED') leaveRejected++;
  }

  /* ──────── 민원 ──────── */
  const cWhere2: Prisma.ComplaintWhereInput = {
    reportedAt: { gte: fromDate, lte: toDate },
    ...(cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {}),
  };
  const complaints = await prisma.complaint.findMany({ where: cWhere2 });
  const cByType = new Map<string, number>();
  const cByStatus = new Map<string, number>();
  for (const c of complaints) {
    cByType.set(c.type, (cByType.get(c.type) ?? 0) + 1);
    cByStatus.set(c.status, (cByStatus.get(c.status) ?? 0) + 1);
  }

  /* ──────── 차량/운행 ──────── */
  const vehicleWhere: Prisma.VehicleWhereInput = cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {};
  const [vehicles, vehicleLogs] = await Promise.all([
    prisma.vehicle.findMany({ where: vehicleWhere, select: { id: true, status: true, vehicleType: true } }),
    prisma.vehicleLog.findMany({
      where: {
        logDate: { gte: fromDate, lte: toDate },
        vehicle: cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : undefined,
      },
      select: { wasteWeightKg: true, fuelUsed: true, startMileage: true, endMileage: true, logDate: true },
    }),
  ]);
  let vehicleWasteKg = 0, vehicleFuelL = 0, vehicleKm = 0;
  for (const l of vehicleLogs) {
    vehicleWasteKg += Number(l.wasteWeightKg ?? 0);
    vehicleFuelL += Number(l.fuelUsed ?? 0);
    if (l.startMileage != null && l.endMileage != null) vehicleKm += l.endMileage - l.startMileage;
  }

  /* ──────── 처리실적 ──────── */
  const wasteRecords = await prisma.wasteTreatmentRecord.findMany({
    where: { recordDate: { gte: fromDate, lte: toDate }, ...(cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {}) },
  });
  const wasteByMaterial = new Map<string, number>();
  let wasteTotal = 0;
  for (const r of wasteRecords) {
    const w = Number(r.weightTon.toString());
    wasteByMaterial.set(r.materialCode, (wasteByMaterial.get(r.materialCode) ?? 0) + w);
    wasteTotal += w;
  }

  /* ──────── 반입실적 ──────── */
  const intakes = await prisma.recyclingCenterIntake.findMany({
    where: { intakeDate: { gte: fromDate, lte: toDate }, ...(cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {}) },
    include: { vehicle: { select: { vehicleNo: true } } },
  });
  const intakeByCategory = new Map<string, number>();
  const intakeByVehicle = new Map<string, { vehicleNo: string; weight: number; count: number }>();
  let intakeTotal = 0;
  for (const i of intakes) {
    const w = Number(i.weightTon.toString());
    intakeByCategory.set(i.materialCategory, (intakeByCategory.get(i.materialCategory) ?? 0) + w);
    const vk = i.vehicleId.toString();
    const cur = intakeByVehicle.get(vk) ?? { vehicleNo: i.vehicle.vehicleNo, weight: 0, count: 0 };
    cur.weight += w;
    cur.count++;
    intakeByVehicle.set(vk, cur);
    intakeTotal += w;
  }

  /* ──────── 안전보건 ──────── */
  const safetyWhereC: Prisma.SafetyReportWhereInput = {
    reportDate: { gte: fromDate, lte: toDate },
    ...(cWhere.contractorId ? { contractorId: cWhere.contractorId as bigint } : {}),
  };
  const safetyReports = await prisma.safetyReport.findMany({ where: safetyWhereC });
  const sByType = new Map<string, number>();
  const sBySeverity = new Map<string, number>();
  for (const s of safetyReports) {
    sByType.set(s.reportType, (sByType.get(s.reportType) ?? 0) + 1);
    sBySeverity.set(s.severity, (sBySeverity.get(s.severity) ?? 0) + 1);
  }

  return NextResponse.json({
    range: { from, to },

    hr: {
      total: users,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count })),
      byPosition: Array.from(positionMap.entries()).map(([code, v]) => ({ code, label: v.label, count: v.count, category: v.category })),
      byDepartment: Array.from(deptMap.entries()).map(([name, count]) => ({ name, count })),
    },

    attendance: {
      records: attTotal,
      checkedIn: attendances.filter((a) => a.checkInTime).length,
      checkedOut: attendances.filter((a) => a.checkOutTime).length,
      earlyLeaves,
      pendingApproval: attendances.filter((a) => a.status === 'PENDING').length,
      daily: Array.from(attDailyMap.entries()).map(([date, count]) => ({ date, count })),
    },

    leave: {
      requests: leaveItems.length,
      approved: leaveApproved,
      pending: leavePending,
      inReview: leaveInReview,
      rejected: leaveRejected,
      approvedDays: Math.round(leaveDays * 10) / 10,
      byType: Array.from(leaveByType.entries()).map(([type, count]) => ({ type, count })),
    },

    complaints: {
      total: complaints.length,
      byType: Array.from(cByType.entries()).map(([type, count]) => ({ type, count })),
      byStatus: Array.from(cByStatus.entries()).map(([status, count]) => ({ status, count })),
    },

    vehicles: {
      total: vehicles.length,
      active: vehicles.filter((v) => v.status === 'ACTIVE').length,
      maintenance: vehicles.filter((v) => v.status === 'MAINTENANCE').length,
      logsCount: vehicleLogs.length,
      wasteKg: Math.round(vehicleWasteKg),
      wasteTon: Math.round(vehicleWasteKg / 100) / 10,
      fuelL: Math.round(vehicleFuelL * 10) / 10,
      totalKm: Math.round(vehicleKm),
    },

    waste: {
      total: Math.round(wasteTotal * 1000) / 1000,
      records: wasteRecords.length,
      byMaterial: Array.from(wasteByMaterial.entries()).map(([code, weight]) => ({ code, weight: Math.round(weight * 1000) / 1000 })),
    },

    intake: {
      total: Math.round(intakeTotal * 1000) / 1000,
      records: intakes.length,
      byCategory: Array.from(intakeByCategory.entries()).map(([code, weight]) => ({ code, weight: Math.round(weight * 1000) / 1000 })),
      byVehicle: Array.from(intakeByVehicle.entries()).map(([id, v]) => ({ vehicleId: id, ...v, weight: Math.round(v.weight * 1000) / 1000 })),
    },

    safety: {
      total: safetyReports.length,
      byType: Array.from(sByType.entries()).map(([type, count]) => ({ type, count })),
      bySeverity: Array.from(sBySeverity.entries()).map(([severity, count]) => ({ severity, count })),
    },
  });
}
