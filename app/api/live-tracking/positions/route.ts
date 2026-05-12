/**
 * GET /api/live-tracking/positions
 *  - 본인 위탁업체 ACTIVE 차량의 시뮬 GPS 위치 (5초마다 폴링)
 *  - simulation 모드: 강남구 그리드 안에서 시간 기반 변화 (deterministic)
 *  - 운영 단계: gisProvider=helpbiz 시 외부 API 프록시 호출 (Phase 2)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

/* 강남구 중심 영역 (약 5km × 5km) */
const CENTER = { lat: 37.4979, lng: 127.0473 };
const RADIUS_DEG = 0.025; // ≈ 2.5km

function simulatePosition(vehicleId: bigint, seedTime: number): { lat: number; lng: number; speed: number; heading: number; status: string } {
  /* deterministic — vehicleId + 30초 단위 슬롯 */
  const slot = Math.floor(seedTime / 30);
  const seed = Number(vehicleId) * 100 + slot;
  const a = Math.sin(seed * 0.93) * 0.5 + 0.5;
  const b = Math.cos(seed * 0.71) * 0.5 + 0.5;
  const lat = CENTER.lat + (a - 0.5) * RADIUS_DEG * 2;
  const lng = CENTER.lng + (b - 0.5) * RADIUS_DEG * 2;
  const speed = Math.round(Math.abs(Math.sin(seed * 0.3)) * 40); // 0~40 km/h
  const heading = Math.round((Math.sin(seed * 0.17) + 1) * 180); // 0~360
  const status = speed === 0 ? 'IDLE' : speed < 5 ? 'STOP' : 'MOVING';
  return { lat, lng, speed, heading, status };
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  /* SUPER_ADMIN/MUNI_ADMIN(contractorId=null) — center 포함한 빈 응답 (클라이언트 throw 방지) */
  if (!session.contractorId) {
    return NextResponse.json({
      provider: 'simulation',
      refreshSec: 5,
      center: CENTER,
      vehicles: [],
      note: '위탁업체에 소속되지 않은 계정 — 표시할 차량 없음',
    });
  }

  const contractorId = BigInt(session.contractorId);
  const config = await prisma.liveTrackingConfig.findUnique({ where: { contractorId } });
  const provider = config?.gisProvider ?? 'simulation';

  const vehicles = await prisma.vehicle.findMany({
    where: { contractorId, status: { in: ['ACTIVE', 'MAINTENANCE'] } },
    include: { driver: { select: { id: true, name: true } } },
    orderBy: { vehicleNo: 'asc' },
  });

  const now = Math.floor(Date.now() / 1000);

  /* local 프로바이더: DB에서 실제 GPS 좌표 조회 */
  let gpsPositionMap = new Map<string, { lat: number; lng: number; speed: number | null; heading: number | null; updatedAt: Date }>();
  if (provider === 'local') {
    const gpsRows = await prisma.vehicleGpsPosition.findMany({
      where: { contractorId },
      select: { vehicleId: true, lat: true, lng: true, speed: true, heading: true, updatedAt: true },
    });
    gpsPositionMap = new Map(gpsRows.map((r) => [r.vehicleId.toString(), {
      lat: Number(r.lat), lng: Number(r.lng),
      speed: r.speed, heading: r.heading, updatedAt: r.updatedAt,
    }]));
  }

  const positions = vehicles.map((v) => {
    if (provider === 'local') {
      const gps = gpsPositionMap.get(v.id.toString());
      const speed = gps?.speed ?? 0;
      const opStatus = v.status === 'MAINTENANCE' ? 'MAINTENANCE' : speed === 0 ? 'IDLE' : speed < 5 ? 'STOP' : 'MOVING';
      return {
        vehicleId: v.id.toString(),
        vehicleNo: v.vehicleNo,
        vehicleType: v.vehicleType,
        vehicleStatus: v.status,
        driverName: v.driver?.name ?? null,
        lat: gps?.lat ?? CENTER.lat,
        lng: gps?.lng ?? CENTER.lng,
        speed,
        heading: gps?.heading ?? 0,
        operationalStatus: opStatus,
        updatedAt: gps?.updatedAt.toISOString() ?? null,
        noData: !gps,
      };
    }
    const pos = simulatePosition(v.id, now);
    return {
      vehicleId: v.id.toString(),
      vehicleNo: v.vehicleNo,
      vehicleType: v.vehicleType,
      vehicleStatus: v.status,
      driverName: v.driver?.name ?? null,
      lat: pos.lat,
      lng: pos.lng,
      speed: pos.speed,
      heading: pos.heading,
      operationalStatus: v.status === 'MAINTENANCE' ? 'MAINTENANCE' : pos.status,
      updatedAt: new Date().toISOString(),
    };
  });

  return NextResponse.json({
    provider,
    refreshSec: config?.refreshSec ?? 5,
    center: CENTER,
    vehicles: positions,
    note: provider === 'simulation'
      ? '시안 모드 — 30초 슬롯 기반 시뮬 GPS'
      : provider === 'local'
      ? 'GPS 단말 직접 수신 모드 (POST /api/live-tracking/gps-ingest)'
      : `외부 GIS provider: ${provider} (Phase 2 실 API 프록시)`,
  });
}
