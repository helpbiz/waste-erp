/**
 * GET /api/recycling-intake/stats?from&to
 *  - 일별 / 차량별 / 성상별 / 시간대별 합계
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function contractorScope(session: { role: string; contractorId: string | null; municipalityId: string | null }) {
  if (session.role === 'SUPER_ADMIN') return {} as Prisma.RecyclingCenterIntakeWhereInput;
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') ?? new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);

  const where: Prisma.RecyclingCenterIntakeWhereInput = {
    ...contractorScope(session),
    intakeDate: { gte: new Date(from), lte: new Date(to) },
  };
  const items = await prisma.recyclingCenterIntake.findMany({
    where,
    include: { vehicle: { select: { vehicleNo: true } } },
  });

  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const vehicleMap = new Map<string, { vehicleNo: string; count: number; weight: number }>();
  const categoryMap = new Map<string, number>();
  let total = 0;

  for (const r of items) {
    const d = r.intakeDate.toISOString().slice(0, 10);
    const ym = d.slice(0, 7);
    const w = Number(r.weightTon.toString());
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + w);
    monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + w);
    categoryMap.set(r.materialCategory, (categoryMap.get(r.materialCategory) ?? 0) + w);
    const vk = r.vehicleId.toString();
    const cur = vehicleMap.get(vk) ?? { vehicleNo: r.vehicle.vehicleNo, count: 0, weight: 0 };
    cur.count++;
    cur.weight += w;
    vehicleMap.set(vk, cur);
    total += w;
  }

  return NextResponse.json({
    range: { from, to },
    total: Math.round(total * 1000) / 1000,
    daily: Array.from(dailyMap.entries()).map(([date, weight]) => ({ date, weight: Math.round(weight * 1000) / 1000 })),
    monthly: Array.from(monthlyMap.entries()).map(([ym, weight]) => ({ ym, weight: Math.round(weight * 1000) / 1000 })),
    byCategory: Array.from(categoryMap.entries()).map(([code, weight]) => ({ code, weight: Math.round(weight * 1000) / 1000 })),
    byVehicle: Array.from(vehicleMap.entries()).map(([id, v]) => ({ vehicleId: id, ...v, weight: Math.round(v.weight * 1000) / 1000 })),
  });
}
