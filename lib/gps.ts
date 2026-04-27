/**
 * GPS 검증 — Plan §3-2 + security-architect 권고
 * - 국내 위경도 박스: 33.0~39.0°N · 124.0~132.0°E
 *   (마라도 33.06, 백령도 37.97, 독도 131.87)
 * - 부정확한 좌표(0,0 또는 박스 밖)는 즉시 거절 → 지오펜스 우회 1차 차단
 */

export const KOREA_BOX = {
  minLat: 33.0,
  maxLat: 39.0,
  minLng: 124.0,
  maxLng: 132.0,
};

export function isInsideKorea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return (
    lat >= KOREA_BOX.minLat &&
    lat <= KOREA_BOX.maxLat &&
    lng >= KOREA_BOX.minLng &&
    lng <= KOREA_BOX.maxLng
  );
}

/** 두 좌표 간 거리 (미터) — Haversine */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
