/**
 * POST /api/vehicle-logs/auto-generate
 *  body: { vehicleId, date }
 *  - GPS 주요 거점(시안: 강남구 청소구역 5개) 기반 운행일지 자동 생성
 *  - 시안: 출발지 → 거점 5개 → 종착지 (총 거리 ~25km, 6시간 운행)
 *  - 실서비스: 차량 GPS 추적 데이터 → DBSCAN 클러스터링 → 거점 자동 추출 (Phase 2)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  vehicleId: z.string(),
  date: z.string(), // YYYY-MM-DD
  driverId: z.string().optional(),
});

/* 시안: 강남구 5개 주요 거점 (실데이터: GPS 클러스터 → 거점 자동 추출) */
const HUBS = [
  { name: '역삼동 차고지', lat: 37.4979, lng: 127.0473, type: 'depot' },
  { name: '삼성역 주변', lat: 37.5089, lng: 127.0631, type: 'collect' },
  { name: '논현역 주변', lat: 37.5114, lng: 127.0212, type: 'collect' },
  { name: '신사동 가로수길', lat: 37.5180, lng: 127.0234, type: 'collect' },
  { name: '강남구청 환경자원센터', lat: 37.5172, lng: 127.0473, type: 'unload' },
  { name: '역삼동 차고지', lat: 37.4979, lng: 127.0473, type: 'return' },
];

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { vehicleId, date, driverId } = parsed.data;

  const v = await prisma.vehicle.findUnique({
    where: { id: BigInt(vehicleId) },
    include: { driver: true },
  });
  if (!v) return NextResponse.json({ error: 'vehicle_not_found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && v.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* 거리 계산 (Haversine) + 추정 — 도심 25km/h, 거점당 정차 30분 */
  const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  let totalKm = 0;
  for (let i = 0; i < HUBS.length - 1; i++) {
    totalKm += haversine(HUBS[i], HUBS[i + 1]);
  }
  totalKm = Math.round(totalKm * 10) / 10;

  /* 거점 별 도착 시각 추정 */
  const driveMinutes = (totalKm / 25) * 60;
  const stopMinutes = (HUBS.length - 2) * 30;
  const totalMinutes = Math.round(driveMinutes + stopMinutes);
  const startTime = new Date(`${date}T06:00:00+09:00`);
  const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
  const stops = HUBS.map((h, i) => ({
    sequence: i + 1,
    name: h.name,
    type: h.type,
    lat: h.lat,
    lng: h.lng,
    arrivedAt: new Date(startTime.getTime() + (i * (totalMinutes / (HUBS.length - 1))) * 60 * 1000).toISOString(),
  }));

  /* VehicleLog upsert (vehicleId + logDate) */
  const logDate = new Date(date);
  const existing = await prisma.vehicleLog.findFirst({
    where: { vehicleId: v.id, logDate },
  });

  const driverIdToUse = driverId ? BigInt(driverId) : v.driverId;
  if (!driverIdToUse) {
    return NextResponse.json({ error: 'driver_required', hint: '차량에 운전자가 지정되지 않았습니다.' }, { status: 400 });
  }

  const startMileage = v.totalMileage ?? 0;
  const endMileage = startMileage + Math.round(totalKm);
  const routeDetail = `[GPS 자동생성] ${date} 06:00 ~ ${endTime.toISOString().slice(11, 16)}\n` +
    `거점 ${HUBS.length}개 (${totalKm}km, ${totalMinutes}분):\n` +
    stops.map((s) => `  ${s.sequence}. ${s.name} [${s.type}] ${s.arrivedAt.slice(11, 16)}`).join('\n');

  let log;
  if (existing) {
    log = await prisma.vehicleLog.update({
      where: { id: existing.id },
      data: {
        driverId: driverIdToUse,
        startMileage,
        endMileage,
        routeDetail,
        tripCount: HUBS.filter((h) => h.type === 'collect').length,
      },
    });
  } else {
    log = await prisma.vehicleLog.create({
      data: {
        vehicleId: v.id,
        driverId: driverIdToUse,
        logDate,
        startMileage,
        endMileage,
        routeDetail,
        tripCount: HUBS.filter((h) => h.type === 'collect').length,
        status: 'SUBMITTED',
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_LOG_AUTO_GENERATE',
      resourceType: 'vehicle_log',
      resourceId: log.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { vehicleId, date, totalKm, stops: HUBS.length } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    logId: log.id.toString(),
    totalKm,
    totalMinutes,
    stops,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    notes: routeDetail,
  });
}
