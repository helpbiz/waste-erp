/**
 * GET /api/live-tracking/heatmap?from=&to=
 *  - 수거 지점 히트맵 데이터: complaints + 차량 운행로그 stops
 *  - 가시범위(contractor) 적용
 *  - format: { points: [{ lat, lng, intensity }] }
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const where: Prisma.ComplaintWhereInput = {
    reportedAt: { gte: fromDate, lte: toDate },
    locationLat: { not: null },
    locationLng: { not: null },
    ...(session.contractorId ? { contractorId: BigInt(session.contractorId) } : {}),
  };

  const complaints = await prisma.complaint.findMany({
    where,
    select: { locationLat: true, locationLng: true, type: true, status: true },
  });

  /* 동일 좌표 그리드 누적 — gis-cost 알고리즘과 동일 (density-based) */
  const grid = new Map<string, number>();
  const gridSize = 0.0005; // ~50m
  for (const c of complaints) {
    if (!c.locationLat || !c.locationLng) continue;
    const lat = Number(c.locationLat.toString());
    const lng = Number(c.locationLng.toString());
    const key = `${Math.round(lat / gridSize)}:${Math.round(lng / gridSize)}`;
    /* 가중치: BULKY_WASTE +2, ILLEGAL_DUMP +2, 그 외 +1 */
    const w = c.type === 'BULKY_WASTE' || c.type === 'ILLEGAL_DUMP' ? 2 : 1;
    grid.set(key, (grid.get(key) ?? 0) + w);
  }

  const maxIntensity = Math.max(1, ...Array.from(grid.values()));
  const points = Array.from(grid.entries()).map(([k, v]) => {
    const [latIdx, lngIdx] = k.split(':').map(Number);
    return {
      lat: latIdx * gridSize,
      lng: lngIdx * gridSize,
      intensity: Math.min(1, v / maxIntensity),
      count: v,
    };
  });

  return NextResponse.json({
    range: { from, to },
    points,
    totalPoints: complaints.length,
    cellsActive: grid.size,
    maxIntensity,
    note: 'gis-cost density-based heatmap (50m grid + BULKY/DUMP 2x 가중)',
  });
}
