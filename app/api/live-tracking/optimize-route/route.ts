/**
 * POST /api/live-tracking/optimize-route
 *  body: { source?: 'complaints'|'manual', from?, to?, points?: [{lat, lng}], startLat?, startLng? }
 *  - source=complaints (기본): 가시범위 RECEIVED/ASSIGNED 민원을 stops로 사용
 *  - source=manual: body의 points 사용
 *  - 결과: TSP 최적 순서 + 거리/시간 + baseline 대비 절감률
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { solveTsp, rawOrderDistance } from '@/lib/tsp';
import { type LatLng } from '@/lib/geo';
import { routePolyline, orsMode } from '@/lib/ors';

export const runtime = 'nodejs';

const Body = z.object({
  source: z.enum(['complaints', 'manual']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  points: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() })).optional(),
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  maxStops: z.number().int().min(2).max(50).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const b = parsed.data;
  const source = b.source ?? 'complaints';
  const maxStops = b.maxStops ?? 30;

  let stops: Array<LatLng & { label: string; type?: string; complaintId?: string }> = [];

  /* 시작점 — 우선순위: body.startLat/Lng > Contractor.garageLat/Lng > 강남구 기본 좌표 */
  let startLat = b.startLat;
  let startLng = b.startLng;
  let startLabel = '🏁 차고지';
  if ((startLat == null || startLng == null) && session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { garageLat: true, garageLng: true, garageAddress: true, companyName: true },
    });
    if (c?.garageLat && c?.garageLng) {
      startLat = Number(c.garageLat.toString());
      startLng = Number(c.garageLng.toString());
      startLabel = `🏁 차고지 (${c.garageAddress ?? c.companyName})`;
    }
  }
  if (startLat == null || startLng == null) {
    startLat = 37.4979;
    startLng = 127.0473;
    startLabel = '🏁 시작점 (차고지 미등록 — 기본 좌표)';
  }
  stops.push({ lat: startLat, lng: startLng, label: startLabel });

  if (source === 'manual' && b.points) {
    stops = stops.concat(b.points.map((p, i) => ({ lat: p.lat, lng: p.lng, label: p.label ?? `Stop ${i + 1}` })));
  } else {
    /* 미처리 민원 좌표 자동 수집 */
    const where: Prisma.ComplaintWhereInput = {
      status: { in: ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] },
      locationLat: { not: null },
      locationLng: { not: null },
      ...(session.contractorId ? { contractorId: BigInt(session.contractorId) } : {}),
    };
    if (b.from && b.to) {
      where.reportedAt = { gte: new Date(b.from), lte: new Date(b.to) };
    }
    const complaints = await prisma.complaint.findMany({
      where,
      select: { id: true, type: true, locationLat: true, locationLng: true, locationAddress: true, citizenName: true },
      orderBy: { reportedAt: 'desc' },
      take: maxStops,
    });
    for (const c of complaints) {
      if (!c.locationLat || !c.locationLng) continue;
      stops.push({
        lat: Number(c.locationLat.toString()),
        lng: Number(c.locationLng.toString()),
        label: `${c.type === 'BULKY_WASTE' ? '📦' : c.type === 'ILLEGAL_DUMP' ? '🗑' : '📋'} #${c.id} ${c.locationAddress ?? c.citizenName ?? ''}`.slice(0, 60),
        type: c.type,
        complaintId: c.id.toString(),  // Phase 2: 워커 RAPID 경로에서 depart/arrive 호출용
      });
    }
  }

  if (stops.length < 2) {
    return NextResponse.json({ error: 'not_enough_points', count: stops.length }, { status: 400 });
  }

  /* TSP 실행 — 시작점=0 고정 */
  const t0 = Date.now();
  const result = solveTsp(stops.map((s) => ({ lat: s.lat, lng: s.lng })), { startIdx: 0 });
  const elapsedMs = Date.now() - t0;

  const baselineKm = rawOrderDistance(stops.map((s) => ({ lat: s.lat, lng: s.lng })));
  const savedKm = Math.round((baselineKm - result.distanceKm) * 1000) / 1000;
  const savedPct = baselineKm > 0 ? Math.round((savedKm / baselineKm) * 1000) / 10 : 0;

  /* ORS 통합 — 도로 따라가는 polyline + 실제 도로 거리 */
  const orderedPoints = result.order.map((idx) => ({ lat: stops[idx].lat, lng: stops[idx].lng }));
  const polyline = await routePolyline(orderedPoints);

  return NextResponse.json({
    ok: true,
    stops: result.order.map((idx) => ({ ...stops[idx], originalIndex: idx })),
    distanceKm: (polyline.source === 'ors' || polyline.source === 'osrm') ? polyline.distanceKm : result.distanceKm,
    durationMin: (polyline.source === 'ors' || polyline.source === 'osrm') ? polyline.durationMin : result.durationMin,
    haversineDistanceKm: result.distanceKm,
    polylineCoords: polyline.coords,
    polylineSource: polyline.source,
    algorithm: result.algorithm,
    iterations: result.iterations,
    elapsedMs,
    baselineKm,
    savedKm,
    savedPct,
    routingMode: orsMode(),
    note: polyline.source === 'osrm'
      ? 'gis-cost 동등: NN + 2-opt + OSRM /route/v1/driving (도로 스냅, 무료 공개 데모)'
      : polyline.source === 'ors'
        ? 'gis-cost 동등: NN + 2-opt + ORS v2/directions (도로 스냅)'
        : 'NN + 2-opt + 직선 (도로 스냅 서버 응답 실패 — fallback)',
  });
}
