/**
 * 라우팅 통합 — OSRM(기본) / OpenRouteService / Haversine fallback
 *
 * 환경변수:
 *   ROUTING_PROVIDER    — osrm | ors | haversine  (기본: osrm — 도로 스냅, 키 불필요)
 *   OSRM_URL            — OSRM base (기본: https://router.project-osrm.org — 공개 데모)
 *   ORS_URL             — 자체호스팅 ORS base
 *   ORS_API_KEY         — 클라우드 ORS
 *   ORS_PROFILE         — driving-car (기본)
 *   ROUTING_TIMEOUT_MS  — 5000 기본
 *
 * gis-cost와 동등 — 도로 스냅 polyline + 실 도로 거리/시간
 */
import { type LatLng, distanceMatrix as haversineMatrix, haversine } from './geo';

const TIMEOUT = Number(process.env.ROUTING_TIMEOUT_MS ?? process.env.ORS_TIMEOUT_MS ?? 5000);
const PROFILE = process.env.ORS_PROFILE ?? 'driving-car';
const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';

export type OrsMode = 'haversine' | 'ors' | 'osrm';

/**
 * 우선순위:
 *   1) ROUTING_PROVIDER 환경변수 명시 → 그대로
 *   2) ORS_URL/ORS_API_KEY 있으면 → ors
 *   3) 그 외 → osrm (공개 도로 스냅, 키 불필요)
 */
export function orsMode(): OrsMode {
  const explicit = (process.env.ROUTING_PROVIDER ?? '').toLowerCase();
  if (explicit === 'haversine') return 'haversine';
  if (explicit === 'ors') return 'ors';
  if (explicit === 'osrm') return 'osrm';
  if (process.env.ORS_URL || process.env.ORS_API_KEY) return 'ors';
  return 'osrm';
}

function orsUrl(path: string): { url: string; headers: Record<string, string> } {
  const base = process.env.ORS_URL ?? 'https://api.openrouteservice.org';
  const url = `${base.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.ORS_API_KEY) headers['Authorization'] = process.env.ORS_API_KEY;
  return { url, headers };
}

async function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT)),
    ]);
  } catch {
    return null;
  }
}

/** Node 내장 https/http 모듈로 fetch 우회 (Docker IPv6 ENETUNREACH 회피) */
async function rawFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> } | null> {
  try {
    /* dynamic import — Edge 호환 + serverless */
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? await import('https') : await import('http');
    return await new Promise((resolve) => {
      const req = mod.request({
        hostname: u.hostname, port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search, method: init.method ?? 'GET',
        headers: init.headers ?? {},
        family: 4,                  // IPv4 강제 — Docker IPv6 ENETUNREACH 방지
        timeout: TIMEOUT,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode ?? 0,
            json: async () => JSON.parse(data),
          });
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      if (init.body) req.write(init.body);
      req.end();
    });
  } catch {
    return null;
  }
}

function fallbackStraight(orderedPoints: LatLng[]) {
  let distKm = 0;
  for (let i = 0; i < orderedPoints.length - 1; i++) distKm += haversine(orderedPoints[i], orderedPoints[i + 1]);
  return {
    coords: orderedPoints.map((p) => [p.lng, p.lat] as [number, number]),
    distanceKm: Math.round(distKm * 1000) / 1000,
    durationMin: Math.round((distKm / 25) * 60),
    source: 'straight' as const,
  };
}

/**
 * N×N 거리 매트릭스 (km)
 */
export async function durationDistanceMatrix(points: LatLng[]): Promise<{ distKm: number[][]; durMin: number[][]; source: 'ors' | 'osrm' | 'haversine' }> {
  const mode = orsMode();
  if (mode === 'haversine' || points.length < 2 || points.length > 50) {
    const distKm = haversineMatrix(points);
    const durMin = distKm.map((row) => row.map((d) => (d / 25) * 60));
    return { distKm, durMin, source: 'haversine' };
  }

  if (mode === 'osrm') {
    const coordsStr = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_URL.replace(/\/$/, '')}/table/v1/driving/${coordsStr}?annotations=distance,duration`;
    const res = await rawFetch(url).then((r) => (r && r.ok ? r.json() : null)) as { code?: string; routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }>; distances?: number[][]; durations?: number[][] } | null;
    if (!res || !res.distances) {
      const distKm = haversineMatrix(points);
      const durMin = distKm.map((row) => row.map((d) => (d / 25) * 60));
      return { distKm, durMin, source: 'haversine' };
    }
    /* OSRM distances는 m, durations는 sec */
    const distKm = (res.distances as number[][]).map((row) => row.map((m) => m / 1000));
    const durMin = (res.durations as number[][]).map((row) => row.map((s) => s / 60));
    return { distKm, durMin, source: 'osrm' };
  }

  /* mode === 'ors' */
  const { url, headers } = orsUrl(`/v2/matrix/${PROFILE}`);
  const body = {
    locations: points.map((p) => [p.lng, p.lat]),
    metrics: ['distance', 'duration'],
    units: 'km',
  };
  const res = await rawFetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => (r && r.ok ? r.json() : null)) as { features?: Array<{ geometry: { coordinates: Array<[number, number]> }; properties: { summary: { distance: number; duration: number } } }>; distances?: number[][]; durations?: number[][] } | null;
  if (!res || !res.distances) {
    const distKm = haversineMatrix(points);
    const durMin = distKm.map((row) => row.map((d) => (d / 25) * 60));
    return { distKm, durMin, source: 'haversine' };
  }
  const distKm = res.distances as number[][];
  const durMin = (res.durations as number[][]).map((row) => row.map((s) => s / 60));
  return { distKm, durMin, source: 'ors' };
}

/**
 * 도로 따라가는 polyline (geojson)
 *  - osrm (기본, 키 불필요): /route/v1/driving/{coords}?overview=full&geometries=geojson
 *  - ors: /v2/directions/{profile}/geojson
 *  - haversine: 직선 polyline (fallback)
 */
export async function routePolyline(orderedPoints: LatLng[]): Promise<{ coords: Array<[number, number]>; distanceKm: number; durationMin: number; source: 'ors' | 'osrm' | 'straight' }> {
  if (orderedPoints.length < 2) {
    return { coords: [], distanceKm: 0, durationMin: 0, source: 'straight' };
  }
  const mode = orsMode();
  if (mode === 'haversine') return fallbackStraight(orderedPoints);

  if (mode === 'osrm') {
    /* OSRM 공개 데모 — https://router.project-osrm.org/route/v1/driving/{lng,lat;...}?overview=full&geometries=geojson */
    const coordsStr = orderedPoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_URL.replace(/\/$/, '')}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
    const res = await rawFetch(url).then((r) => (r && r.ok ? r.json() : null)) as { code?: string; routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }>; distances?: number[][]; durations?: number[][] } | null;
    if (!res || res.code !== 'Ok' || !res.routes?.[0]) {
      /* OSRM 실패 (rate limit, 좌표 invalid 등) → 직선 fallback */
      return fallbackStraight(orderedPoints);
    }
    const route = res.routes[0];
    const coords = route.geometry.coordinates as Array<[number, number]>;
    const distanceKm = Math.round((route.distance / 1000) * 1000) / 1000;
    const durationMin = Math.round(route.duration / 60);
    return { coords, distanceKm, durationMin, source: 'osrm' };
  }

  /* mode === 'ors' */
  const { url, headers } = orsUrl(`/v2/directions/${PROFILE}/geojson`);
  const body = {
    coordinates: orderedPoints.map((p) => [p.lng, p.lat]),
    instructions: false,
    units: 'km',
  };
  const res = await rawFetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => (r && r.ok ? r.json() : null)) as { features?: Array<{ geometry: { coordinates: Array<[number, number]> }; properties: { summary: { distance: number; duration: number } } }>; distances?: number[][]; durations?: number[][] } | null;
  if (!res || !res.features?.[0]) return fallbackStraight(orderedPoints);
  const f = res.features[0];
  const coords = f.geometry.coordinates as Array<[number, number]>;
  const distanceKm = Math.round((f.properties.summary.distance as number) * 1000) / 1000;
  const durationMin = Math.round((f.properties.summary.duration as number) / 60);
  return { coords, distanceKm, durationMin, source: 'ors' };
}
