// Design Ref: §3.1.1, §3.3 — VARCHAR(20) + TS const tuple 검증.
// Plan SC: WasteTreatmentFacility 모델 마이그레이션 적용 (Plan §4.1)
// Plan §5 Risk: enum 마이그레이션 회피 — 향후 type 추가 시 DB 변경 없이 코드 상수만 갱신

export const FACILITY_TYPES = [
  'INCINERATOR',       // 소각장
  'OUTSOURCED',        // 위탁처리장
  'LANDFILL',          // 매립시설
  'RECYCLING_CENTER',  // 자원순환센터
  'AVAC',              // 자동집하시설 (Automated Vacuum Collection) — 2026-05-02 추가
  'OTHER',             // 기타
] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  INCINERATOR: '소각장',
  OUTSOURCED: '위탁처리장',
  LANDFILL: '매립시설',
  RECYCLING_CENTER: '자원순환센터',
  AVAC: '자동집하시설',
  OTHER: '기타',
};

export function isFacilityType(value: unknown): value is FacilityType {
  return typeof value === 'string' && (FACILITY_TYPES as readonly string[]).includes(value);
}
