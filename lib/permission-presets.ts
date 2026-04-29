/**
 * 권한 프리셋 3종 — 신규 위탁업체 개설 시 지자체 권한 매트릭스 일괄 적용용.
 * Design Ref: docs/specs/08_역할권한_설계서.md §7.2 처방 2.
 */

export type PresetKey = 'standard' | 'monitor_only' | 'full_open';

export type PolicyPreset = {
  key: PresetKey;
  label: string;
  description: string;
  allowedScreens: string[];
  allowedReports: string[];
  exportEnabled: boolean;
  bulkExportEnabled: boolean;
};

/* 화면 코드는 기존 운영 코드 (대시보드/민원/안전/근태/차량/실적/건강/통계 등) 와 일치 */
export const ALL_SCREENS = [
  'dashboard',
  'complaints',
  'safety',
  'attendance',
  'vehicles',
  'performance',
  'health',
  'live-vehicles',
  'reports',
  'users',
] as const;

export const ALL_REPORTS = [
  'master-stats',
  'daily-treatment',
  'attendance-monthly',
  'leave-monthly',
] as const;

export const PRESETS: PolicyPreset[] = [
  {
    key: 'standard',
    label: '표준 (90% 권장)',
    description: '대시보드 + 민원 + 안전 + 통계 보고서 — 일반 지자체 기본값',
    allowedScreens: ['dashboard', 'complaints', 'safety', 'reports'],
    allowedReports: ['master-stats', 'daily-treatment'],
    exportEnabled: true,
    bulkExportEnabled: false,
  },
  {
    key: 'monitor_only',
    label: '모니터링 전용',
    description: '대시보드만 — 시범 단계 / 소극적 지자체',
    allowedScreens: ['dashboard'],
    allowedReports: [],
    exportEnabled: false,
    bulkExportEnabled: false,
  },
  {
    key: 'full_open',
    label: '전체 공개',
    description: '모든 화면 + 보고서 + 일괄 다운로드 — 광역단체 / 전수 검토',
    allowedScreens: [...ALL_SCREENS],
    allowedReports: [...ALL_REPORTS],
    exportEnabled: true,
    bulkExportEnabled: true,
  },
];

export function getPreset(key: PresetKey): PolicyPreset {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[0];
}
