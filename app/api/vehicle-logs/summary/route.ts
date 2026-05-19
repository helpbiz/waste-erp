/**
 * GET /api/vehicle-logs/summary — 차량일지 현황 (날짜 범위 + 상태별 집계)
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, status=DRAFT|SUBMITTED|APPROVED, page=1, limit=50
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleLogWhere } from '@/lib/vehicle-logs';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const statusParam = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  const base = vehicleLogWhere(session);

  const rangeWhere: Prisma.VehicleLogWhereInput = {
    ...base,
    ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from) || to && /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? {
          logDate: {
            ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? { gte: new Date(from + 'T00:00:00.000Z') } : {}),
            ...(to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? { lte: new Date(to + 'T00:00:00.000Z') } : {}),
          },
        }
      : {}),
  };

  const validStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED'];
  const listWhere: Prisma.VehicleLogWhereInput = {
    ...rangeWhere,
    ...(statusParam && validStatuses.includes(statusParam)
      ? { status: statusParam as 'DRAFT' | 'SUBMITTED' | 'APPROVED' }
      : {}),
  };

  const [items, total, counts] = await Promise.all([
    prisma.vehicleLog.findMany({
      where: listWhere,
      orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vehicle: { select: { vehicleNo: true, vehicleType: true, vehicleTon: true } },
        driver: { select: { name: true } },
        zone: { select: { zoneName: true } },
      },
    }),
    prisma.vehicleLog.count({ where: listWhere }),
    prisma.vehicleLog.groupBy({
      by: ['status'],
      where: rangeWhere,
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0 };
  for (const row of counts) {
    statusCounts[row.status] = row._count._all;
  }

  return NextResponse.json({
    total,
    page,
    limit,
    statusCounts,
    items: items.map((l) => ({
      id: l.id.toString(),
      logDate: l.logDate.toISOString().slice(0, 10),
      status: l.status,
      vehicleNo: l.vehicle.vehicleNo,
      vehicleType: l.vehicle.vehicleType,
      vehicleTon: l.vehicle.vehicleTon,
      driverName: l.driver.name,
      zoneName: l.zone?.zoneName ?? null,
      startMileage: l.startMileage,
      endMileage: l.endMileage,
      wasteWeightKg: l.wasteWeightKg ? Number(l.wasteWeightKg) : null,
      tripCount: l.tripCount,
      routeDetail: l.routeDetail,
    })),
  });
}
