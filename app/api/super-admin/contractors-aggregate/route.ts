/**
 * GET /api/super-admin/contractors-aggregate?municipalityId=&from=&to=
 *  - 관할 지자체의 모든 contractor 자료 통합 집계
 *  - 권한: SUPER_ADMIN (전체) / MUNI_ADMIN (본인 muni 만)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { nowKst } from '@/lib/dates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'MUNI_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  let municipalityIdStr = url.searchParams.get('municipalityId');
  const kstYear = nowKst().getUTCFullYear();
  const from = url.searchParams.get('from') ?? `${kstYear}-01-01`;
  const to = url.searchParams.get('to') ?? `${kstYear}-12-31`;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  /* MUNI_ADMIN 은 본인 muni 강제 — 쿼리 파라미터 무시하고 session 값 사용 */
  if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ error: 'no_muni_scope' }, { status: 403 });
    municipalityIdStr = session.municipalityId;
  }

  if (!municipalityIdStr) {
    return NextResponse.json({ error: 'municipalityId_required' }, { status: 400 });
  }
  const municipalityId = parseId(municipalityIdStr);
  if (!municipalityId) return NextResponse.json({ error: 'invalid_municipalityId' }, { status: 400 });

  const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
  if (!muni) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const contractors = await prisma.contractor.findMany({
    where: { municipalityId },
    orderBy: { companyName: 'asc' },
  });
  const cIds = contractors.map((c) => c.id);

  if (cIds.length === 0) {
    return NextResponse.json({
      municipality: { id: muni.id.toString(), name: muni.name, code: muni.code },
      range: { from, to },
      contractors: [],
      summary: null,
    });
  }

  /* 거래처별 핵심 지표 */
  const [users, attendances, leaves, complaints, pendingComplaints, vehicles, vehicleLogs, waste, intakes, safety] = await Promise.all([
    prisma.user.groupBy({ by: ['contractorId'], where: { contractorId: { in: cIds } }, _count: true }),
    prisma.attendanceRecord.groupBy({
      by: ['contractorId'],
      where: { contractorId: { in: cIds }, workDate: { gte: fromDate, lte: toDate } },
      _count: true,
    }),
    prisma.leaveRequest.findMany({
      where: { worker: { contractorId: { in: cIds } }, AND: [{ startDate: { lte: toDate } }, { endDate: { gte: fromDate } }] },
      include: { worker: { select: { contractorId: true } } },
    }),
    prisma.complaint.groupBy({
      by: ['contractorId'],
      where: { contractorId: { in: cIds }, reportedAt: { gte: fromDate, lte: toDate } },
      _count: true,
    }),

    prisma.complaint.groupBy({
      by: ['contractorId'],
      where: { contractorId: { in: cIds }, status: { in: ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] } },
      _count: true,
    }),
    prisma.vehicle.groupBy({ by: ['contractorId'], where: { contractorId: { in: cIds } }, _count: true }),
    prisma.vehicleLog.findMany({
      where: { vehicle: { contractorId: { in: cIds } }, logDate: { gte: fromDate, lte: toDate } },
      include: { vehicle: { select: { contractorId: true } } },
    }),
    prisma.wasteTreatmentRecord.findMany({
      where: { contractorId: { in: cIds }, recordDate: { gte: fromDate, lte: toDate } },
    }),
    prisma.recyclingCenterIntake.findMany({
      where: { contractorId: { in: cIds }, intakeDate: { gte: fromDate, lte: toDate } },
    }),
    prisma.safetyReport.groupBy({
      by: ['contractorId'],
      where: { contractorId: { in: cIds }, reportDate: { gte: fromDate, lte: toDate } },
      _count: true,
    }),
  ]);

  /* contractorId 별 합산 helper */
  const byCid = <T,>(arr: T[], key: (r: T) => bigint): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of arr) {
      const k = key(r).toString();
      const cur = m.get(k) ?? [];
      cur.push(r);
      m.set(k, cur);
    }
    return m;
  };

  const leavesByCid = byCid(leaves, (l) => l.worker.contractorId!);
  const vehicleLogsByCid = byCid(vehicleLogs, (l) => l.vehicle.contractorId);
  const wasteByCid = byCid(waste, (r) => r.contractorId);
  const intakesByCid = byCid(intakes, (r) => r.contractorId);

  /* CONTRACTOR_ADMIN 사용자의 전화/이메일 batch fetch — 그룹 발송용 */
  const admins = await prisma.user.findMany({
    where: { role: 'CONTRACTOR_ADMIN', status: 'ACTIVE', contractorId: { in: cIds } },
    select: { contractorId: true, name: true, phone: true },
  });
  const adminMap = new Map<string, { name: string; phone: string | null }>();
  for (const a of admins) {
    if (a.contractorId) adminMap.set(a.contractorId.toString(), { name: a.name, phone: a.phone });
  }

  const items = contractors.map((c) => {
    const cid = c.id.toString();
    const leaveItems = leavesByCid.get(cid) ?? [];
    const logItems = vehicleLogsByCid.get(cid) ?? [];
    const wasteItems = wasteByCid.get(cid) ?? [];
    const intakeItems = intakesByCid.get(cid) ?? [];
    const admin = adminMap.get(cid);
    return {
      id: cid,
      companyName: c.companyName,
      businessNo: c.businessNo,
      status: c.status,
      /* 그룹 발송용 contact 정보 */
      ceoName: c.ceoName ?? null,
      phoneMain: c.phoneMain ?? null,
      emailMain: c.emailMain ?? null,
      adminName: admin?.name ?? null,
      adminPhone: admin?.phone ?? null,
      users: users.find((u) => u.contractorId?.toString() === cid)?._count ?? 0,
      attendance: attendances.find((u) => u.contractorId.toString() === cid)?._count ?? 0,
      leaves: leaveItems.length,
      leavesApproved: leaveItems.filter((l) => l.status === 'APPROVED').length,
      complaints: complaints.find((u) => u.contractorId.toString() === cid)?._count ?? 0,
      pendingComplaints: pendingComplaints.find((u) => u.contractorId.toString() === cid)?._count ?? 0,
      vehicles: vehicles.find((u) => u.contractorId.toString() === cid)?._count ?? 0,
      vehicleLogs: logItems.length,
      vehicleWasteKg: Math.round(logItems.reduce((s, l) => s + Number(l.wasteWeightKg ?? 0), 0)),
      waste: Math.round(wasteItems.reduce((s, r) => s + Number(r.weightTon.toString()), 0) * 1000) / 1000,
      intake: Math.round(intakeItems.reduce((s, r) => s + Number(r.weightTon.toString()), 0) * 1000) / 1000,
      safety: safety.find((u) => u.contractorId.toString() === cid)?._count ?? 0,
    };
  });

  const summary = {
    contractors: items.length,
    totalUsers: items.reduce((s, x) => s + x.users, 0),
    totalAttendance: items.reduce((s, x) => s + x.attendance, 0),
    totalLeaves: items.reduce((s, x) => s + x.leaves, 0),
    totalComplaints: items.reduce((s, x) => s + x.complaints, 0),
    totalVehicles: items.reduce((s, x) => s + x.vehicles, 0),
    totalVehicleLogs: items.reduce((s, x) => s + x.vehicleLogs, 0),
    totalWasteTon: Math.round(items.reduce((s, x) => s + x.waste, 0) * 1000) / 1000,
    totalIntakeTon: Math.round(items.reduce((s, x) => s + x.intake, 0) * 1000) / 1000,
    totalSafety: items.reduce((s, x) => s + x.safety, 0),
  };

  return NextResponse.json({
    municipality: { id: muni.id.toString(), name: muni.name, code: muni.code },
    range: { from, to },
    contractors: items,
    summary,
  });
}
