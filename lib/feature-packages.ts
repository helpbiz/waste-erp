/**
 * 회사별 기능 권한 — 요금제 패키지 (Template).
 *
 * 사전 정의된 기능 세트를 슈퍼관리자가 회사에 일괄 적용.
 * 적용 시: 패키지에 정의된 8개 feature 모두 upsert (true/false 명시).
 *
 * MVP 4-tier:
 *   TRIAL    — 체험판 (공지·TTS 만)
 *   BASIC    — 기본형 (자동배정·근태·원가 추가)
 *   STANDARD — 표준형 (추천경로·차량위치 추가)
 *   PRO      — 프로형 (AI 인근 추천 추가 = 전체)
 *
 * 향후: DB 기반 커스텀 패키지(FeaturePackage 모델)로 확장 가능.
 */
import type { FeatureKey } from './features';

export type PackageKey = 'TRIAL' | 'BASIC' | 'STANDARD' | 'PRO';

export type FeaturePackage = {
  key: PackageKey;
  label: string;
  description: string;
  badge: string;          /* UI 표시용 — 컬러 클래스명 */
  monthlyHint: string;    /* 영업 표기용 (실제 결제 모델은 별도) */
  features: Record<FeatureKey, boolean>;
};

export const FEATURE_PACKAGES: FeaturePackage[] = [
  {
    key: 'TRIAL',
    label: '🆓 체험판 (TRIAL)',
    description: '공지사항 + 음성 알림만. 신규 도입사 1개월 평가용.',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    monthlyHint: '무료',
    features: {
      announcements: true,
      voiceTts: true,
      complaintAutoAssign: false,
      aiNearbyDispatch: false,
      recommendedRoute: false,
      costCalculation: false,
      vehicleTracking: false,
      attendanceGps: false,
      workerSuggestion: true,
      nocAccess: false,  /* SUPER_ADMIN 명시 승인 필요 — 패키지 기본 OFF */
      avac: false,       /* 자동집하시설 전용 — 해당 업체에만 개별 활성화 */
    },
  },
  {
    key: 'BASIC',
    label: '🟢 기본형 (BASIC)',
    description: '소규모 위탁업체 — 민원 자동배정·근태·원가까지.',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    monthlyHint: '월 ₩XXX,XXX 가정',
    features: {
      announcements: true,
      voiceTts: true,
      complaintAutoAssign: true,
      aiNearbyDispatch: false,
      recommendedRoute: false,
      costCalculation: true,
      vehicleTracking: false,
      attendanceGps: true,
      workerSuggestion: true,
      nocAccess: false,  /* SUPER_ADMIN 명시 승인 필요 — 패키지 기본 OFF */
      avac: false,
    },
  },
  {
    key: 'STANDARD',
    label: '🔵 표준형 (STANDARD)',
    description: '중형 — 추천 경로·차량 실시간 위치까지 운영 자동화.',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    monthlyHint: '월 ₩XXX,XXX 가정',
    features: {
      announcements: true,
      voiceTts: true,
      complaintAutoAssign: true,
      aiNearbyDispatch: false,
      recommendedRoute: true,
      costCalculation: true,
      vehicleTracking: true,
      attendanceGps: true,
      workerSuggestion: true,
      nocAccess: false,  /* SUPER_ADMIN 명시 승인 필요 — 패키지 기본 OFF */
      avac: false,
    },
  },
  {
    key: 'PRO',
    label: '⭐ 프로형 (PRO)',
    description: '전체 기능 — AI 인근 워커 추천까지 포함.',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    monthlyHint: '월 ₩X,XXX,XXX 가정',
    features: {
      announcements: true,
      voiceTts: true,
      complaintAutoAssign: true,
      aiNearbyDispatch: true,
      recommendedRoute: true,
      costCalculation: true,
      vehicleTracking: true,
      attendanceGps: true,
      workerSuggestion: true,
      nocAccess: false,  /* SUPER_ADMIN 명시 승인 필요 — 패키지 기본 OFF */
      avac: false,
    },
  },
];

const PACKAGE_MAP = new Map<PackageKey, FeaturePackage>(FEATURE_PACKAGES.map((p) => [p.key, p]));

export function getPackage(key: PackageKey | string): FeaturePackage | null {
  return PACKAGE_MAP.get(key as PackageKey) ?? null;
}

/* 회사의 현재 기능 상태가 어느 패키지에 해당하는지 자동 식별 (정확히 매치되지 않으면 null = 커스텀) */
export function detectPackage(features: Record<FeatureKey, boolean>): PackageKey | null {
  for (const pkg of FEATURE_PACKAGES) {
    let match = true;
    for (const k of Object.keys(pkg.features) as FeatureKey[]) {
      if (pkg.features[k] !== features[k]) { match = false; break; }
    }
    if (match) return pkg.key;
  }
  return null;
}
