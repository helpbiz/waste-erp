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

/* 사용자 진단 2026-04-29: MUNI_ADMIN cross-tenant leak 차단.
   기존엔 MUNI_ADMIN 의 contractorId=null → { id: -1 } 폴백이지만,
   여러 prisma 쿼리에서 cWhere 가 'where' 의 일부로 spread 되면 안전 무효화 가능.
   명시적으로 MUNI 분기 추가. */
function contractorScope<T extends { contractorId?: bigint | { equals?: bigint } | null }>(
  session: { role: string; contractorId: string | null; municipalityId: string | null }
): Record<string, unknown> {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    /* contractor relation 통한 muni 필터 — User/Complaint/Attendance 등 contractor relation 보유 모델 적용 */
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  return { id: BigInt(-1) };
}

/* 한국 행정구역 토큰 추출 — 광역단체 + 시·군·구 + 동·읍·면·리 까지만.
   사용자 요청 2026-04-29: 지역 Top 10은 행정동명까지 표시.
   예) '서울특별시 강남구 테헤란로 152' → '서울특별시 강남구'
       '서울특별시 강남구 역삼동 737-32' → '서울특별시 강남구 역삼동'
       '경기도 성남시 분당구 정자동 ...' → '경기도 분당구 정자동' (last 시·군·구 우선) */
function extractKoreanArea(address: string | null | undefined): string {
  const trimmed = (address ?? '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const tokens = trimmed.split(' ');
  let level1 = '';  // 광역단체
  let level2 = '';  // 시·군·구 (last match wins → 분당구 > 성남시)
  let level3 = '';  // 동·읍·면·리
  for (const t of tokens) {
    if (/(특별시|광역시|특별자치시|특별자치도|도)$/.test(t)) {
      level1 = t;
    } else if (/[가-힣]+(시|군|구)$/.test(t)) {
      level2 = t;
    } else if (/[가-힣]+(동|읍|면|리)$/.test(t) && !level3) {
      level3 = t;  // first match wins for dong (legal address comes earlier)
    }
  }
  const parts = [level1, level2, level3].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : tokens.slice(0, 2).join(' ');
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
  /* MUNI_ADMIN 일 때 contractorId 가 cWhere 에 없고 contractor relation 으로 들어옴.
     cross-tenant leak 방지를 위해 모든 모델에 일관 적용할 scope 미리 산출. */
  const muniId = session.role === 'MUNI_ADMIN' && session.municipalityId
    ? BigInt(session.municipalityId) : null;
  const directContractorId = session.role !== 'SUPER_ADMIN' && session.role !== 'MUNI_ADMIN' && session.contractorId
    ? BigInt(session.contractorId) : null;
  /* 사용자 요청 2026-04-29: 위탁업체별 개별/통합 보고서 — ?contractorId=X 옵션.
     SUPER/MUNI 가 선택한 단일 contractorId 가 있으면 그것만 필터링.
     없으면 권한별 기본 scope (MUNI 산하 전체 / SUPER 전체) 적용. */
  const explicitContractorId = url.searchParams.get('contractorId');
  let pickedContractorId: bigint | null = null;
  if (explicitContractorId && /^\d+$/.test(explicitContractorId)) {
    const candidate = BigInt(explicitContractorId);
    /* 권한 검증: SUPER 는 모두 가능, MUNI 는 본인 muni 산하만, CONTRACTOR/INTERNAL 은 본인 회사만 */
    if (session.role === 'SUPER_ADMIN') {
      pickedContractorId = candidate;
    } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
      const ownsMuni = await prisma.contractor.findFirst({
        where: { id: candidate, municipalityId: BigInt(session.municipalityId) },
        select: { id: true },
      });
      if (ownsMuni) pickedContractorId = candidate;
    } else if (session.contractorId && candidate.toString() === session.contractorId) {
      pickedContractorId = candidate;
    }
  }
  /* 모델별 scope (해당 모델의 prisma where 에 spread):
     - 단일 contractor 선택 시 그것만
     - 그 외는 권한별 기본 scope */
  const scopeContractorIdField: Record<string, unknown> = pickedContractorId
    ? { contractorId: pickedContractorId }
    : directContractorId
    ? { contractorId: directContractorId }
    : muniId
    ? { contractor: { municipalityId: muniId } }
    : {};

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
    ...scopeContractorIdField,
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
    worker: scopeContractorIdField,
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
    ...scopeContractorIdField,
  };
  const complaints = await prisma.complaint.findMany({
    where: cWhere2,
    include: {
      contractor: { select: { companyName: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  const cByType = new Map<string, number>();
  const cByStatus = new Map<string, number>();
  /* 사용자 요청 2026-04-29: 민원 분포 시각화 보강 — 시간/요일/월/지역/처리성과/만족도/위탁업체별 */
  const cByHour = new Array(24).fill(0) as number[]; // 0-23시
  const cByWeekday = new Array(7).fill(0) as number[]; // 0(일)~6(토)
  const cByMonth = new Map<string, number>(); // YYYY-MM
  const cByArea = new Map<string, number>(); // 주소 첫 토큰 (시·도/구·군 단위 추정)
  const cByContractor = new Map<string, { name: string; count: number }>();
  const cSatByScore = new Array(5).fill(0) as number[]; // 1-5점
  let cSatTotal = 0;
  let cSatCount = 0;
  let cResolveSumMs = 0;
  let cResolvedCount = 0;
  let cOverdue = 0;
  let cUrgent = 0;
  let cUnassigned = 0;
  /* Phase 2 KPI: 출동~도착 / 도착~완료 / 응답시간 */
  let cDepartToArriveSumMs = 0;
  let cDepartToArriveCount = 0;
  let cArriveToResolveSumMs = 0;
  let cArriveToResolveCount = 0;
  let cReportToDepartSumMs = 0;
  let cReportToDepartCount = 0;
  /* 워커별 KPI: assigneeId → { name, count, resolvedCount, avgResolveHrs, avgDepartArrMin, avgArrResMin } */
  type WorkerKpiAcc = {
    name: string;
    count: number;
    resolvedCount: number;
    resolveSumMs: number;
    departArriveSumMs: number;
    departArriveCount: number;
    arriveResolveSumMs: number;
    arriveResolveCount: number;
  };
  const cByWorker = new Map<string, WorkerKpiAcc>();
  /* KST 기준으로 시간/요일 카운트 (UTC offset +9h) */
  const KST_MS = 9 * 3600 * 1000;
  for (const c of complaints) {
    cByType.set(c.type, (cByType.get(c.type) ?? 0) + 1);
    cByStatus.set(c.status, (cByStatus.get(c.status) ?? 0) + 1);
    const kst = new Date(c.reportedAt.getTime() + KST_MS);
    cByHour[kst.getUTCHours()]++;
    cByWeekday[kst.getUTCDay()]++;
    const ym = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
    cByMonth.set(ym, (cByMonth.get(ym) ?? 0) + 1);
    if (c.locationAddress) {
      /* 행정동명까지 추출 (광역단체 + 시·군·구 + 동·읍·면·리) */
      const area = extractKoreanArea(c.locationAddress);
      if (area) cByArea.set(area, (cByArea.get(area) ?? 0) + 1);
    }
    if (c.contractor) {
      const k = c.contractorId.toString();
      const cur = cByContractor.get(k) ?? { name: c.contractor.companyName, count: 0 };
      cur.count++;
      cByContractor.set(k, cur);
    }
    if (c.satisfactionScore != null && c.satisfactionScore >= 1 && c.satisfactionScore <= 5) {
      cSatByScore[c.satisfactionScore - 1]++;
      cSatTotal += c.satisfactionScore;
      cSatCount++;
    }
    if (c.resolvedAt) {
      cResolveSumMs += c.resolvedAt.getTime() - c.reportedAt.getTime();
      cResolvedCount++;
    }
    /* Phase 2 KPI */
    if (c.departedAt && c.arrivedAt) {
      cDepartToArriveSumMs += c.arrivedAt.getTime() - c.departedAt.getTime();
      cDepartToArriveCount++;
    }
    if (c.arrivedAt && c.resolvedAt) {
      cArriveToResolveSumMs += c.resolvedAt.getTime() - c.arrivedAt.getTime();
      cArriveToResolveCount++;
    }
    if (c.departedAt) {
      cReportToDepartSumMs += c.departedAt.getTime() - c.reportedAt.getTime();
      cReportToDepartCount++;
    }
    if (c.assignee) {
      const wk = c.assignee.id.toString();
      const acc = cByWorker.get(wk) ?? {
        name: c.assignee.name, count: 0, resolvedCount: 0, resolveSumMs: 0,
        departArriveSumMs: 0, departArriveCount: 0,
        arriveResolveSumMs: 0, arriveResolveCount: 0,
      };
      acc.count++;
      if (c.resolvedAt) {
        acc.resolvedCount++;
        acc.resolveSumMs += c.resolvedAt.getTime() - c.reportedAt.getTime();
      }
      if (c.departedAt && c.arrivedAt) {
        acc.departArriveSumMs += c.arrivedAt.getTime() - c.departedAt.getTime();
        acc.departArriveCount++;
      }
      if (c.arrivedAt && c.resolvedAt) {
        acc.arriveResolveSumMs += c.resolvedAt.getTime() - c.arrivedAt.getTime();
        acc.arriveResolveCount++;
      }
      cByWorker.set(wk, acc);
    }
    if (c.dueDate && c.dueDate < new Date() && c.status !== 'COMPLETED' && c.status !== 'REJECTED') {
      cOverdue++;
    }
    if (c.isUrgent) cUrgent++;
    if (!c.assignedTo && c.status !== 'COMPLETED' && c.status !== 'REJECTED') cUnassigned++;
  }
  const cAvgDepartArriveMin = cDepartToArriveCount > 0
    ? Math.round((cDepartToArriveSumMs / cDepartToArriveCount) / 60_000)
    : 0;
  const cAvgArriveResolveMin = cArriveToResolveCount > 0
    ? Math.round((cArriveToResolveSumMs / cArriveToResolveCount) / 60_000)
    : 0;
  const cAvgReportDepartMin = cReportToDepartCount > 0
    ? Math.round((cReportToDepartSumMs / cReportToDepartCount) / 60_000)
    : 0;
  const cAvgResolveHours = cResolvedCount > 0
    ? Math.round((cResolveSumMs / cResolvedCount) / 3600_000 * 10) / 10
    : 0;
  const cActiveCount = complaints.filter(c => c.status !== 'COMPLETED' && c.status !== 'REJECTED').length;
  const cOverdueRate = cActiveCount > 0 ? Math.round((cOverdue / cActiveCount) * 1000) / 10 : 0;
  const cSatAvg = cSatCount > 0 ? Math.round((cSatTotal / cSatCount) * 10) / 10 : 0;

  /* ──────── 차량/운행 ──────── */
  const vehicleWhere: Prisma.VehicleWhereInput = scopeContractorIdField as Prisma.VehicleWhereInput;
  const [vehicles, vehicleLogs] = await Promise.all([
    prisma.vehicle.findMany({ where: vehicleWhere, select: { id: true, status: true, vehicleType: true } }),
    prisma.vehicleLog.findMany({
      where: {
        logDate: { gte: fromDate, lte: toDate },
        vehicle: scopeContractorIdField,
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
    where: { recordDate: { gte: fromDate, lte: toDate }, ...scopeContractorIdField },
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
    where: { intakeDate: { gte: fromDate, lte: toDate }, ...scopeContractorIdField },
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
    ...scopeContractorIdField,
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
      /* 분포 시각화 보강 (2026-04-29) */
      byHour: cByHour.map((count, hour) => ({ hour, count })),
      byWeekday: cByWeekday.map((count, day) => ({ day, count })),
      byMonth: Array.from(cByMonth.entries())
        .map(([ym, count]) => ({ ym, count }))
        .sort((a, b) => a.ym.localeCompare(b.ym)),
      byArea: Array.from(cByArea.entries())
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byContractor: Array.from(cByContractor.entries())
        .map(([id, v]) => ({ contractorId: id, name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count),
      performance: {
        avgResolveHours: cAvgResolveHours,
        resolvedCount: cResolvedCount,
        overdueCount: cOverdue,
        overdueRate: cOverdueRate,
        urgentCount: cUrgent,
        unassignedCount: cUnassigned,
        /* Phase 2 KPI (분 단위) */
        avgReportToDepartMin: cAvgReportDepartMin,
        avgDepartToArriveMin: cAvgDepartArriveMin,
        avgArriveToResolveMin: cAvgArriveResolveMin,
        departToArriveCount: cDepartToArriveCount,
      },
      byWorker: Array.from(cByWorker.entries())
        .map(([id, w]) => ({
          workerId: id,
          name: w.name,
          count: w.count,
          resolvedCount: w.resolvedCount,
          avgResolveHours: w.resolvedCount > 0 ? Math.round((w.resolveSumMs / w.resolvedCount) / 3600_000 * 10) / 10 : 0,
          avgDepartToArriveMin: w.departArriveCount > 0 ? Math.round((w.departArriveSumMs / w.departArriveCount) / 60_000) : 0,
          avgArriveToResolveMin: w.arriveResolveCount > 0 ? Math.round((w.arriveResolveSumMs / w.arriveResolveCount) / 60_000) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      satisfaction: {
        count: cSatCount,
        avg: cSatAvg,
        byScore: cSatByScore.map((count, i) => ({ score: i + 1, count })),
      },
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
