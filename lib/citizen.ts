/**
 * 시민 민원앱 — 특허 10-2024-0084638 청구항 4·5·6·7
 *
 *  - 인증: 전화번호만 (시안 단계). Phase 2: SMS OTP
 *  - 식별: localStorage 'citizen-phone' + 'citizen-name'
 *  - 위탁업체 자동 매칭: 위치 좌표 → 가장 가까운 contractor (시안: 첫 번째 ACTIVE)
 *
 * 청구항 6 자동 후보 판정:
 *  - 동일 phone에서 N분 내 M건 초과 → flaggedAsCandidate=true
 *  - 시안 임계: 60분 / 5건 (운영 단계 정책 룰 분리)
 */
export const URGENT_TAGS = [
  { key: 'LONG_NEGLECTED', label: '오래 방치됨', icon: '⏰' },
  { key: 'ROAD_KILL',      label: '동물 로드킬', icon: '🐾' },
  { key: 'KIDS_DANGER',    label: '아이들 위험', icon: '⚠️' },
  { key: 'OTHER',          label: '직접 입력',   icon: '✏️' },
] as const;

export type UrgentTag = typeof URGENT_TAGS[number]['key'];

export const URGENT_LABEL: Record<string, string> = {
  LONG_NEGLECTED: '오래 방치됨',
  ROAD_KILL: '동물 로드킬',
  KIDS_DANGER: '아이들 위험',
  OTHER: '기타',
};

export const CANDIDATE_THRESHOLD = {
  windowMinutes: 60,
  maxReports: 5,
};

/** 청구항 6 — 무단 투기/허위 신고 후보 자동 판정 */
export function evaluateCandidateFlag(
  recentReports: Array<{ reportedAt: Date }>,
  now: Date = new Date()
): { flagged: boolean; reason: string | null } {
  if (recentReports.length < CANDIDATE_THRESHOLD.maxReports) {
    return { flagged: false, reason: null };
  }
  const windowMs = CANDIDATE_THRESHOLD.windowMinutes * 60 * 1000;
  const recentInWindow = recentReports.filter(
    (r) => now.getTime() - r.reportedAt.getTime() < windowMs
  );
  if (recentInWindow.length >= CANDIDATE_THRESHOLD.maxReports) {
    return {
      flagged: true,
      reason: `${CANDIDATE_THRESHOLD.windowMinutes}분 내 ${recentInWindow.length}건 신고 (임계 ${CANDIDATE_THRESHOLD.maxReports}건 초과)`,
    };
  }
  return { flagged: false, reason: null };
}

/**
 * 청구항 7 — 도착 예정 시각 추정
 * 시안: 배출 수행 기관(=위탁업체) 출퇴근 GPS 평균 vs 민원 위치 거리 + 평균 이동 속도(시속 25km, 도심)
 * Phase 2: 실시간 위치 + Naver Maps Directions API
 */
export function estimateArrivalEta(
  vehicleLat: number | null,
  vehicleLng: number | null,
  targetLat: number | null,
  targetLng: number | null,
  avgSpeedKmh = 25
): Date | null {
  if (!vehicleLat || !vehicleLng || !targetLat || !targetLng) return null;
  /* Haversine */
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(targetLat - vehicleLat);
  const dLng = toRad(targetLng - vehicleLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(vehicleLat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) ** 2;
  const distKm = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  const minutes = (distKm / avgSpeedKmh) * 60;
  return new Date(Date.now() + minutes * 60 * 1000);
}
