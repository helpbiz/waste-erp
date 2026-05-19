/**
 * 회사(위탁업체)별 기능 권한 — Feature Entitlements.
 *
 * 슈퍼관리자가 회사마다 기능을 ON/OFF 할 수 있도록 한다.
 * row 미존재 시 카탈로그 default 값(true) 반환 → 기존 contractor 자동 호환.
 */
import { prisma } from '@/lib/db';

export type FeatureKey =
  | 'announcements'
  | 'voiceTts'
  | 'complaintAutoAssign'
  | 'aiNearbyDispatch'
  | 'recommendedRoute'
  | 'costCalculation'
  | 'vehicleTracking'
  | 'attendanceGps'
  | 'workerSuggestion'
  | 'nocAccess'               // NOC per-tenant 풀스크린 관제 화면 (Agent Team 합의 2026-05-02)
  | 'avac'                    // 자동집하시설(AVAC) 전용 모듈 — 시설별 TBM·시설운전기록·실적 3시트
  | 'leaveApprovalSingleStage'  // 휴가 결재 1단계(관리자 단독 최종 결재) — 대표 최종 결재 생략
  | 'vehicleLogFuel'            // 차량일지 주유 카드 표시 여부
  | 'vehicleLogUrea'           // 차량일지 요소수 필드 표시 여부 (주유 카드 안)
  | 'safetyNearMiss'           // 아차사고 보고 — 근로자 아차사고 신고 기능
  | 'safetyIncident'           // 재해보고 — 근로자 재해 발생 신고 기능
  | 'payslip';                 // 급여명세서 — 엑셀 업로드 → 근로자 앱 개별 발송·조회·인쇄

export type FeatureMeta = {
  key: FeatureKey;
  label: string;
  description: string;
  group: string;
  defaultEnabled: boolean;
};

export const FEATURE_CATALOG: FeatureMeta[] = [
  {
    key: 'announcements',
    label: '공지사항 시스템',
    description: '회사 내부 공지 작성·표시·푸시 기능',
    group: '커뮤니케이션',
    defaultEnabled: true,
  },
  {
    key: 'voiceTts',
    label: '음성 알림 (TTS)',
    description: '공지·민원 도착 시 음성 안내(남/여 voice)',
    group: '커뮤니케이션',
    defaultEnabled: true,
  },
  {
    key: 'complaintAutoAssign',
    label: '민원 자동 배정',
    description: '신규 민원을 기동반에 자동 할당 (부하·거리 점수 기반)',
    group: '민원',
    defaultEnabled: true,
  },
  {
    key: 'aiNearbyDispatch',
    label: 'AI 인근 워커 추천',
    description: '주소·GPS 기반 거리 분석으로 인근 작업자에게 broadcast',
    group: '민원',
    defaultEnabled: true,
  },
  {
    key: 'recommendedRoute',
    label: '기동반 추천 경로',
    description: 'RAPID 워커용 미처리 민원 최적 순회 경로 안내',
    group: '운행',
    defaultEnabled: true,
  },
  {
    key: 'costCalculation',
    label: '원가 계산',
    description: '월별 인건비·차량·연료·간접비 원가 산출',
    group: '관리',
    defaultEnabled: true,
  },
  {
    key: 'vehicleTracking',
    label: '차량 실시간 위치',
    description: 'Live Vehicles 트래킹 + 추천 경로 시각화',
    group: '운행',
    defaultEnabled: true,
  },
  {
    key: 'attendanceGps',
    label: '출퇴근 GPS',
    description: 'check-in 시 위경도 기록 — AI 인근 추천에도 사용',
    group: '근태',
    defaultEnabled: true,
  },
  {
    key: 'workerSuggestion',
    label: '작업자 익명 건의함',
    description: '익명 만족도·개선 의견 수집 → 경영 반영. userId 미저장(완전 익명).',
    group: '커뮤니케이션',
    defaultEnabled: true,
  },
  {
    /* Agent Team 합의 2026-05-02 — security: 마스킹·14일 회전 / cto: 신청-승인 / be: scope 일원화 */
    key: 'nocAccess',
    label: '🖥 관제 화면 (NOC)',
    description:
      '회사·지자체 전용 풀스크린 관제 화면 (50" TV·Chromium kiosk). ' +
      '활성화 시 ADMIN 들이 자기 회사 NOC 운영. 외부 노출 위험으로 SUPER_ADMIN 명시 승인 필요.',
    group: '관제',
    defaultEnabled: false,   // 기본 OFF — SUPER_ADMIN 승인 시만 활성화
  },
  {
    key: 'avac',
    label: '🏗 자동집하시설(AVAC) 모듈',
    description:
      '시설별 TBM·시설운전기록(일일 운전/처리량)·실적 Excel 3시트·PDF 출력. ' +
      '자동집하시설 관리 위탁업체 전용. 비-AVAC 업체에는 이 탭들이 미노출.',
    group: '시설운영',
    defaultEnabled: false,   // 기본 OFF — 해당 업체에만 슈퍼관리자가 수동 활성화
  },
  {
    key: 'leaveApprovalSingleStage',
    label: '휴가 결재 단계 간소화',
    description:
      '활성화 시 관리자(1차 결재권자)가 최종 결재까지 단독 처리 가능 — 대표 최종 결재 단계 생략. ' +
      '소규모 업체나 대표가 결재 위임한 경우 사용.',
    group: '근태',
    defaultEnabled: false,
  },
  {
    key: 'vehicleLogFuel',
    label: '차량일지 — 주유 카드',
    description: '차량일지 폼에 주유량·주유금액 입력 카드를 표시합니다. 주유 관리가 필요 없는 업체는 OFF.',
    group: '차량',
    defaultEnabled: true,
  },
  {
    key: 'vehicleLogUrea',
    label: '차량일지 — 요소수 필드',
    description: '주유 카드 안에 요소수(L)·요소수금액(원) 필드를 추가합니다. 경유 차량이 있는 업체만 ON.',
    group: '차량',
    defaultEnabled: false,
  },
  {
    key: 'safetyNearMiss',
    label: '아차사고 보고',
    description: '근로자 안전 화면에서 아차사고(위험요소) 신고 버튼을 표시합니다. OFF 시 버튼 미노출.',
    group: '안전',
    defaultEnabled: true,
  },
  {
    key: 'safetyIncident',
    label: '재해보고',
    description: '근로자 안전 화면에서 재해 발생 신고 버튼을 표시합니다. OFF 시 버튼 미노출.',
    group: '안전',
    defaultEnabled: true,
  },
  {
    key: 'payslip',
    label: '급여명세서',
    description: '엑셀 업로드 → 근로자 앱 개별 발송·조회·인쇄. 지급/공제 항목 회사별 설정 가능.',
    group: '급여',
    defaultEnabled: true,
  },
];

const CATALOG_MAP = new Map<string, FeatureMeta>(FEATURE_CATALOG.map((f) => [f.key, f]));

export function getFeatureMeta(key: string): FeatureMeta | null {
  return CATALOG_MAP.get(key) ?? null;
}

/**
 * 단일 기능 활성 여부.
 *  - contractorId null/undefined 면 false (시스템 단위 기능은 별도 처리).
 *  - 카탈로그 미정의 key 는 false (방어적 default — 새 key 추가 시 명시적 등록 강제).
 *  - DB row 없음 → 카탈로그 defaultEnabled.
 */
export async function hasFeature(
  contractorId: bigint | string | number | null | undefined,
  key: FeatureKey
): Promise<boolean> {
  if (contractorId == null) return false;
  const meta = CATALOG_MAP.get(key);
  if (!meta) return false;

  const cId = typeof contractorId === 'bigint' ? contractorId : BigInt(contractorId);
  const row = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId: cId, featureKey: key } },
    select: { enabled: true },
  });
  return row ? row.enabled : meta.defaultEnabled;
}

/** 회사의 전체 기능 상태 (UI 매트릭스용). DB row 없는 항목은 default 값으로 채움. */
export async function listContractorFeatures(contractorId: bigint | string | number) {
  const cId = typeof contractorId === 'bigint' ? contractorId : BigInt(contractorId);
  const rows = await prisma.contractorFeature.findMany({
    where: { contractorId: cId },
    orderBy: { featureKey: 'asc' },
  });
  const rowMap = new Map(rows.map((r) => [r.featureKey, r]));

  return FEATURE_CATALOG.map((meta) => {
    const row = rowMap.get(meta.key);
    return {
      key: meta.key,
      label: meta.label,
      description: meta.description,
      group: meta.group,
      defaultEnabled: meta.defaultEnabled,
      enabled: row ? row.enabled : meta.defaultEnabled,
      isDefault: !row,
      updatedAt: row ? row.updatedAt.toISOString() : null,
      updatedBy: row?.updatedBy?.toString() ?? null,
    };
  });
}

/** AVAC(자동집하시설) 모듈 활성 여부 편의 함수. */
export async function isAvacContractor(contractorId: bigint | string | number | null | undefined): Promise<boolean> {
  return hasFeature(contractorId, 'avac');
}

/** AVAC 업체에 속한 시설 목록 (시설별 TBM 선택용). */
export async function getAvacFacilities(contractorId: bigint) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { municipalityId: true },
  });
  if (!contractor) return [];
  return prisma.wasteTreatmentFacility.findMany({
    where: { municipalityId: contractor.municipalityId, active: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  });
}

/** upsert — 변경 audit 는 호출자 책임 */
export async function setContractorFeature(params: {
  contractorId: bigint | string | number;
  featureKey: FeatureKey;
  enabled: boolean;
  updatedBy: bigint | string | number;
}) {
  const cId = typeof params.contractorId === 'bigint' ? params.contractorId : BigInt(params.contractorId);
  const uId = typeof params.updatedBy === 'bigint' ? params.updatedBy : BigInt(params.updatedBy);
  return prisma.contractorFeature.upsert({
    where: { contractorId_featureKey: { contractorId: cId, featureKey: params.featureKey } },
    update: { enabled: params.enabled, updatedBy: uId },
    create: {
      contractorId: cId,
      featureKey: params.featureKey,
      enabled: params.enabled,
      updatedBy: uId,
    },
  });
}

/** 시설 담당자 권한 조회 — session userId로 DB에서 직접 읽어 반환. */
export async function getFacilityOperatorScope(userId: string): Promise<{
  isFacilityOperator: boolean;
  primaryFacilityId: bigint | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { isFacilityOperator: true, primaryFacilityId: true },
  });
  return {
    isFacilityOperator: user?.isFacilityOperator ?? false,
    primaryFacilityId: user?.primaryFacilityId ?? null,
  };
}
