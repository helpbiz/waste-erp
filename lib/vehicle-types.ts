/**
 * 차종 라벨 + 옵션 단일 정의 (UI/API 공유)
 *  - 추가/변경 시 이 파일만 수정 → 스키마 enum과 동기화
 */
export const VEHICLE_TYPE_VALUES = [
  'PRESS_REFUSE',
  'COMPACTOR_REFUSE',
  'SEALED_REFUSE',
  'ARM_ROLL',
  'DUMP_TRUCK',
  'GRAB_TRUCK',
  'CARGO_TRUCK',
  'REFUSE_DUMP',
  'TANK_LORRY',
  'WING_BODY',
  'FORKLIFT',
  'OTHER',
] as const;

export type VehicleTypeKey = typeof VEHICLE_TYPE_VALUES[number];

export const VEHICLE_TYPE_LABEL: Record<VehicleTypeKey, string> = {
  PRESS_REFUSE:     '압착진개',
  COMPACTOR_REFUSE: '압축진개',
  SEALED_REFUSE:    '밀폐식',
  ARM_ROLL:         '암롤차',
  DUMP_TRUCK:       '덤프트럭',
  GRAB_TRUCK:       '집게차',
  CARGO_TRUCK:      '카고트럭',
  REFUSE_DUMP:      '진개덤프',
  TANK_LORRY:       '탱크로리',
  WING_BODY:        '윙바디',
  FORKLIFT:         '지게차',
  OTHER:            '기타',
};

export const VEHICLE_TYPE_OPTIONS: Array<{ value: VehicleTypeKey; label: string }> =
  VEHICLE_TYPE_VALUES.map((v) => ({ value: v, label: VEHICLE_TYPE_LABEL[v] }));

export function vehicleTypeLabel(t: string): string {
  return (VEHICLE_TYPE_LABEL as Record<string, string>)[t] ?? t;
}
