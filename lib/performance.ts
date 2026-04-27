/**
 * 실적관리 — 폐기물 성상 마스터 + 가시범위
 */
export const WASTE_MATERIALS = [
  { code: 'GENERAL',       label: '일반',           order: 1 },
  { code: 'FOOD',          label: '음식물',         order: 2 },
  { code: 'RECYCLING',     label: '재활용',         order: 3 },
  { code: 'WOOD',          label: '폐목재',         order: 4 },
  { code: 'COAL_ASH',      label: '연탄재',         order: 5 },
  { code: 'MIXED_BLDG',    label: '혼합건폐',       order: 6 },
  { code: 'PLASTIC',       label: '합성수지',       order: 7 },
  { code: 'BATTERY',       label: '폐건전지',       order: 8 },
  { code: 'FLUORESCENT',   label: '폐형광등',       order: 9 },
  { code: 'MILK_CARTON',   label: '우유팩',         order: 10 },
  { code: 'VINYL',         label: '폐비닐',         order: 11 },
  { code: 'POCKET_SPRING', label: '포켓스프링',     order: 12 },
  { code: 'SCRAP_IRON',    label: '잡철',           order: 13 },
  { code: 'STYROFOAM',     label: '스티로폼',       order: 14 },
] as const;

export const MATERIAL_LABEL: Record<string, string> = Object.fromEntries(
  WASTE_MATERIALS.map((m) => [m.code, m.label])
);

export const INTAKE_CATEGORIES = [
  { code: 'GENERAL',   label: '일반' },
  { code: 'FOOD',      label: '음식물' },
  { code: 'RECYCLING', label: '재활용' },
  { code: 'WOOD',      label: '폐목재' },
] as const;

export const INTAKE_LABEL: Record<string, string> = Object.fromEntries(
  INTAKE_CATEGORIES.map((m) => [m.code, m.label])
);
