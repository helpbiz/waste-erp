/* CleanERP 서비스 소개서 — 가변 데이터 중앙 관리.
   브랜드명·예시 지자체·예시 위탁업체 등 영업 컨텍스트별로 바뀔 수 있는 값을 모은다.
   page.tsx 는 이 파일만 import — 슬라이드 디자인은 건드리지 않고 값만 갈아끼우면 된다.

   변경 이력:
   - 2026-05-02: 초안 — helpbiz → 공비Lab, 강남구청 → 용산구청 (사용자 요청).
*/

export const BRAND = {
  /** 운영사 표시명 (본문·일반 텍스트). */
  company: '공비Lab',
  /** 운영사 대문자 표기 (표지 footer·강조용). */
  companyUpper: '공비LAB',
  /** Thank You 슬라이드 브랜드 라인. */
  brandLine: 'CleanERP · 공비Lab',
  /** 서비스 접속 URL (도메인은 현행 유지 — 추후 변경 시 여기만 수정). */
  serviceUrl: 'wci.helpbiz.kr',
  /** 영업 문의 이메일. */
  contactEmail: 'contact@helpbiz.kr',
  /** 영업 문의 전화. */
  contactTel: '02-XXXX-XXXX',
  /** 영업 운영 시간. */
  contactOps: '평일 09:00 — 18:00',
} as const;

/** 예시로 노출되는 주(主) 지자체.
   - 슬라이드 10 (멀티테넌시), 13 (민원관리 mock), 17 (실적), 19 (슈퍼관리자)에 사용.
   - 영업 미팅 상대 지자체에 맞춰 수시 교체 가능. */
export const EXAMPLE_MUNI = {
  /** 헤드 라인에 등장하는 주 지자체. */
  primary: {
    name: '용산구청',
    district: '용산구',
    /** 민원 mock에 들어갈 동(洞) 3개 — primary 지자체 관할. */
    neighborhoods: ['이태원동', '한남동', '후암동'] as const,
  },
  /** 멀티테넌시 다이어그램에 나열되는 보조 지자체 4종. primary 와 합쳐 총 5종 노출. */
  secondary: ['송파구청', '밀양시 시설관리공단', '기장군 도시관리공단', '거제시청'] as const,
} as const;

/** 예시로 노출되는 위탁업체 4종 (멀티테넌시 다이어그램).
   index 0이 primary 지자체 관할 — count(N) 뱃지가 붙는다. */
export const EXAMPLE_CONTRACTORS = [
  '용산청소(주)',
  '송파환경(주)',
  '㈜밀양위생',
  '기장환경산업',
] as const;

/** 권한 매트릭스 프리셋 시연용 (슬라이드 19 — 슈퍼관리자 콘솔 mock).
   primary 지자체가 첫 행에 위치. */
export const EXAMPLE_PRESETS = [
  { muni: '용산구청',           preset: '표준 프리셋',   scope: '대시보드 · 민원 · 보고서 · 안전', dl: '✓' },
  { muni: '송파구청',           preset: '모니터링 전용', scope: '대시보드만',                       dl: '✗' },
  { muni: '밀양시 시설관리공단', preset: '전체 공개',     scope: '모든 화면 + bulk DL',              dl: '✓' },
] as const;
