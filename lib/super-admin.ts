/**
 * 슈퍼관리자 헬퍼 — 지자체 권한 매트릭스
 */
export const ALL_SCREENS = [
  { code: 'dashboard',     label: '메인 대시보드' },
  { code: 'users',         label: '사용자관리' },
  { code: 'attendance',    label: '근태관리' },
  { code: 'payroll',       label: '인건비 정산' },
  { code: 'complaints',    label: '민원관리' },
  { code: 'safety',        label: '산업안전보건' },
  { code: 'health',        label: '건강기록카드' },
  { code: 'vehicles',      label: '차량관리' },
  { code: 'live-vehicles', label: '실시간 차량조회' },
  { code: 'performance',   label: '실적관리' },
  { code: 'reports',       label: '통계/보고서' },
  { code: 'bulky-waste',   label: '대형폐기물 설정' },
] as const;

export const ALL_REPORTS = [
  { code: 'attendance',  label: '근태 보고서' },
  { code: 'leave',       label: '휴가 보고서' },
  { code: 'complaints',  label: '민원 보고서' },
  { code: 'vehicles',    label: '차량 운행 보고서' },
  { code: 'waste',       label: '처리실적 보고서' },
  { code: 'intake',      label: '반입실적 보고서' },
  { code: 'safety',      label: '안전보건 보고서' },
  { code: 'hr',          label: '인사 보고서' },
] as const;

export function parseCsv(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}
