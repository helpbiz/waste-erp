/**
 * 공통 지리 유틸 — Haversine, BBOX, 거리 매트릭스
 */

export type LatLng = { lat: number; lng: number };

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine 거리 (km) */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** N×N 거리 매트릭스 (km) */
export function distanceMatrix(points: LatLng[]): number[][] {
  const n = points.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(points[i], points[j]);
      m[i][j] = d;
      m[j][i] = d;
    }
  }
  return m;
}

/** BBOX (지도 줌 레벨 결정용) */
export function bbox(points: LatLng[]): { sw: LatLng; ne: LatLng; center: LatLng } | null {
  if (points.length === 0) return null;
  let minLat = points[0].lat, maxLat = points[0].lat;
  let minLng = points[0].lng, maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    sw: { lat: minLat, lng: minLng },
    ne: { lat: maxLat, lng: maxLng },
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
  };
}

/* P0-residual: PIPA 위치정보 보호 — 작성 시점에 4자리 라운딩 (~10m 격자)
   - 작업자 거주지·이동패턴 추론 차단
   - 추천경로 알고리즘은 ~10m 정확도면 충분 (도시 도로 단위)
   - 운영 코드는 항상 roundCoord() 통과 후 DB 저장 권장 */
export const COORD_PRECISION = 4 as const;

export function roundCoord(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = Math.pow(10, COORD_PRECISION);
  return Math.round(value * f) / f;
}
