/**
 * GET /api/live-tracking/positions
 *  - 본인 위탁업체 ACTIVE 차량의 시뮬 GPS 위치 (5초마다 폴링)
 *  - simulation 모드: 강남구 그리드 안에서 시간 기반 변화 (deterministic)
 *  - 운영 단계: gisProvider=helpbiz 시 외부 API 프록시 호출 (Phase 2)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { decryptField } from '@/lib/crypto';
import { fetchEtracePositions } from '@/lib/gps-adapters/etrace';

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

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  /* SUPER_ADMIN: ?contractorId=<id> 로 특정 업체 조회 가능 */
  const url = new URL(req.url);
  const cidParam = url.searchParams.get('contractorId');
  const contractorIdResolved = cidParam && session.role === 'SUPER_ADMIN'
    ? (() => { try { return BigInt(cidParam); } catch { return null; } })()
    : session.contractorId ? BigInt(session.contractorId) : null;

  if (!contractorIdResolved) {
    return NextResponse.json({
      provider: 'simulation',
      refreshSec: 5,
      center: CENTER,
      vehicles: [],
      note: '위탁업체에 소속되지 않은 계정 — ?contractorId=<id> 쿼리 필요',
    });
  }

  const contractorId = contractorIdResolved;
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

  /* etrace 프로바이더: ETRACE API Pull */
  let etracePositionMap = new Map<string, { lat: number; lng: number; speed: number; heading: number; gpsTime: string | null; location: string | null }>();
  if (provider === 'etrace' && config?.apiKeyEnc && config.gisBaseUrl) {
    try {
      const apiKey = await decryptField(config.apiKeyEnc);
      if (apiKey) {
        const pc = config.providerConfig as Record<string, unknown> | null;
        const lastSeq = pc?.lastSeq != null ? Number(pc.lastSeq) : null;
        const result = await fetchEtracePositions({
          baseUrl: config.gisBaseUrl,
          apiKey,
          lastSeq,
          contractorId: contractorId.toString(),
          throttleMs: (config.refreshSec ?? 5) * 1000,
        });
        etracePositionMap = result.positions as unknown as typeof etracePositionMap;

        /* lastSeq 갱신 (변경된 경우만) */
        if (result.newLastSeq !== lastSeq) {
          await prisma.liveTrackingConfig.update({
            where: { contractorId },
            data: { providerConfig: { ...(pc ?? {}), lastSeq: result.newLastSeq } },
          });
        }
      }
    } catch (e) {
      console.error('[etrace] positions fetch error', e instanceof Error ? e.message : e);
    }
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
    if (provider === 'etrace') {
      const gps = etracePositionMap.get(v.vehicleNo);
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
        updatedAt: gps?.gpsTime ?? null,
        location: gps?.location ?? null,
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
      : provider === 'etrace'
      ? 'ETRACE 실시간 GPS (SEQ 기반 Pull)'
      : `외부 GIS provider: ${provider}`,
  });
}
