/* CleanERP 서비스 소개서 — 모든 슬라이드 카피 중앙 관리.
   page.tsx 는 디자인(JSX 구조 + 클래스)만, 이 파일은 텍스트만 — 완전 분리.

   영업 컨텍스트별로 카피를 갈아끼우려면 이 파일만 수정하면 된다.
   브랜드명·예시 지자체·연락처는 _config.ts (재참조).

   변경 이력:
   - 2026-05-02: 초안 — page.tsx 인라인 카피 일괄 추출. */

import { BRAND, EXAMPLE_MUNI } from './_config';

export const COPY = {
  toolbar: 'CleanERP / Brochure v0.4 — 27 slides',

  /* ─── 01 표지 ─── */
  cover: {
    tag: '226개 지자체와 위탁업체가 함께 쓰는',
    /** 헤드라인 — 강조 단어를 별도 분리 (accent 클래스 적용 위해). */
    headline: {
      line1: { pre: '운영은 ', accent: '자동화', post: '하고,' },
      line2: { pre: '안전은 ', accent: '시스템', post: '으로 지킵니다.' },
    },
    tagline: '생활폐기물 수집운반업을 위한 운영·안전 통합 ERP',
    footerYear: '2026',
  },

  /* ─── 02 목차 ─── */
  toc: {
    title: '목차',
    items: [
      { num: '01', label: '개발 배경',     en: 'The Why',     page: '04' },
      { num: '02', label: 'CleanERP 소개', en: 'About',       page: '08' },
      { num: '03', label: '주요 기능',     en: 'Features',    page: '12' },
      { num: '04', label: '도입 절차',     en: 'Onboarding',  page: '22' },
      { num: '05', label: '요금제',        en: 'Pricing',     page: '24' },
      { num: '06', label: '도입 문의',     en: 'Contact',     page: '26' },
    ],
  },

  /* ─── 챕터 디바이더 (1-6) ─── */
  chapters: {
    1: { en: 'CHAPTER 01 · THE WHY',    num: '01', title: '개발 배경',     sub: '왜 지금 생활폐기물 수집운반업에 통합 ERP가 필요한가 — 1인 운영 사무실의 현실, 쏟아지는 지자체 보고, 그리고 중대재해처벌법이 만든 새로운 책임 구조.' },
    2: { en: 'CHAPTER 02 · ABOUT',      num: '02', title: 'CleanERP 소개', sub: `${BRAND.company}가 운영하는 멀티테넌트 ERP — 226개 지자체와 N개 위탁업체가 한 인스턴스 위에서 데이터 격리된 채 동시 운영됩니다. 5단계 Role 체계로 권한이 정확히 분리됩니다.` },
    3: { en: 'CHAPTER 03 · FEATURES',   num: '03', title: '주요 기능',     sub: '민원 접수부터 지자체 보고까지, 출퇴근부터 안전점검까지 — 폐기물 수집운반업이 매일 반복하는 6대 운영 흐름을 한 시스템에서 자동화합니다.' },
    4: { en: 'CHAPTER 04 · ONBOARDING', num: '04', title: '도입 절차',     sub: `계약부터 정식 운영까지 14일 — 1인 운영 사무실도 부담 없는 4단계 절차. ${BRAND.company} 운영팀이 셋업·교육·시범까지 핸즈온 지원합니다.` },
    5: { en: 'CHAPTER 05 · PRICING',    num: '05', title: '요금제',        sub: '계정 단위 단순 과금 — 사업장 인원이 늘어나도 부담 없이 확장. 첫 1개월 무료 운영, 광역단체·1,000 계정 이상은 별도 협의.' },
    6: { en: 'CHAPTER 06 · CONTACT',    num: '06', title: '도입 문의',     sub: '생활폐기물 수집운반업의 운영·안전 통합 관리, 지금 시작하세요. 첫 미팅에서 30분 내 신규 위탁업체 셋업 시연을 보실 수 있습니다.' },
    total: '/06',
  },

  /* ─── 04 3대 통증 ─── */
  pain: {
    tag: '개발 배경',
    title: '생활폐기물 수집운반업의 3대 운영 통증',
    cards: [
      { headline: '수기·엑셀에 묶인 운영', icon: '01', emphasis: '담당자 퇴사 = 업무 단절',         body: '엑셀 파일이 PC 한 대에 갇히고, 카톡으로 흩어진 지시는 추적 불가. 담당자가 떠나면 데이터도 함께 사라집니다.' },
      { headline: '쏟아지는 지자체 보고',   icon: '02', emphasis: '월 30종+ 보고 양식',             body: '일일 수집량·민원 처리·차량 운행·인력 출근 — 보고 양식만 30종을 넘는데, 1인 운영 사무실로는 정리할 시간조차 부족합니다.' },
      { headline: '중대재해법 사각지대',     icon: '03', emphasis: '운전원 사고 = 사업주 형사처벌', body: 'TBM·안전점검 기록이 없으면 면책 불가. 그러나 출퇴근부터 작업 종료까지의 안전 활동을 종이로 관리하는 한, 입증 자체가 어렵습니다.' },
    ],
    footer: { left: '수기 관리의 한계', arrow: '→', right: '통합 ERP 전환은 이제 선택이 아닌 생존 조건' },
  },

  /* ─── 05 통계 (핵심 숫자) ─── */
  stat: {
    tag: '개발 배경',
    title: '한 시스템에 담아낸 폐기물 수집운반업의 운영 구조',
    cards: [
      { label: 'Multi-Tenancy', num: '226', unit: '지자체', body: '전국 226개 시·군·구가 사전 시드되어 신규 위탁업체 셋업 시 즉시 매핑 — 광역단체부터 1개구 위탁업체까지 단일 인스턴스 위에서 동시 운영됩니다.' },
      { label: 'Roles',          num: '5',   unit: '단계',  body: '운영사·지자체·회사·내부팀장·근로자 — 5단계 RBAC. 한 사람이 한 Role을 갖고, 한 Role은 보이는 화면이 다릅니다.' },
      { label: 'Mobile-First',   num: '100', unit: '%',    body: '운전원·수거원·기동반 — 현장 인력 전원 모바일 PWA. 별도 앱스토어 배포 없이 즉시 사용 가능, 56″ NOC와 동일한 데이터를 공유합니다.' },
    ],
    source: '출처: CleanERP 시드 데이터·내부 운영 통계 (2026 기준)',
  },

  /* ─── 06 Before / After ─── */
  compare: {
    tag: '개발 배경',
    title: '수기를 시스템으로, 분산을 통합으로',
    arrow: '→',
    before: {
      label: 'BEFORE',
      headline: '엑셀·카톡·종이로 흩어진 운영',
      items: [
        '출퇴근은 종이 출근부 + 사진 카톡',
        '민원은 전화·문자로 받아 종이에 메모',
        '차량 위치는 전화로 확인',
        '지자체 보고는 매월 엑셀로 수기 작성',
        '안전점검은 종이로 보관 — 입증 어려움',
      ],
    },
    after: {
      label: 'AFTER · CLEANERP',
      headline: '한 시스템에서 운영도 안전도',
      items: [
        '모바일 GPS 출퇴근 + 자동 집계',
        '민원 접수→배정→처리→보고 자동 흐름',
        'NOC 56″ 화면에서 전 차량 실시간 추적',
        '지자체 보고서 클릭 한 번으로 자동 생성',
        'TBM·안전점검 전자서명 + 5년 감사 보존',
      ],
    },
  },

  /* ─── 08 운영사 + 핵심 숫자 ─── */
  about: {
    tag: 'CleanERP 소개',
    title: `${BRAND.company}이 만드는, 폐기물 수집운반업 전용 ERP`,
    cards: [
      { label: 'Operating Company', value: BRAND.company,    valueSize: '3cqw',   body: '생활폐기물 수집운반업 1인 운영 사무실의 현실에서 출발 — 영세 위탁업체도 30분 내 신규 셋업 가능한 단순함을 설계 원칙으로 합니다.' },
      { label: 'Domain Focus',      value: 'WCI 전용',         valueSize: '3cqw',   body: '범용 ERP가 아닌 생활폐기물 수집운반업(Waste Collection Industry) 전용 — 민원·차량·실적·안전 도메인을 한 시스템에 녹였습니다.' },
      { label: 'Service URL',       value: BRAND.serviceUrl,  valueSize: '2.4cqw', body: '웹 + PWA 모바일 단일 도메인. 운영자는 데스크톱 콘솔, 운전원은 폰 — 별도 앱 설치 없이 같은 URL.' },
    ],
  },

  /* ─── 09 5단계 Role ─── */
  roles: {
    tag: 'CleanERP 소개',
    title: '5단계 Role — 보이는 화면이 직책에 따라 달라집니다',
    rows: [
      { depth: 0, key: 'SUPER_ADMIN',      name: '시스템관리자', desc: `플랫폼 전체 운영 (${BRAND.company})` },
      { depth: 1, key: 'MUNI_ADMIN',       name: '지자체관리자', desc: '관할 위탁업체 모니터링·보고서 조회' },
      { depth: 2, key: 'CONTRACTOR_ADMIN', name: '회사관리자',    desc: '위탁업체 대표 — 회사 운영 총괄' },
      { depth: 3, key: 'INTERNAL_ADMIN',   name: '일반관리자',    desc: '팀장·실장·안전관리자 — 결재·배차·민원 배정' },
      { depth: 4, key: 'WORKER',           name: '일반근로자',    desc: '운전원·수거원 — 모바일 출퇴근·작업·서명' },
    ],
  },

  /* ─── 10 멀티테넌시 ─── */
  tenancy: {
    tag: 'CleanERP 소개',
    title: '한 시스템, 226개 지자체 × N개 위탁업체 — 데이터는 절대 섞이지 않습니다',
    leftColTitle: '지자체',
    rightColTitle: '위탁업체',
    hub: { name: 'CleanERP', sub: 'SINGLE INSTANCE · MULTI-TENANT' },
    primaryMuniCount: '226',
    primaryContractorCount: 'N',
    arrow: '⋮',
  },

  /* ─── 12 6대 카테고리 타임라인 ─── */
  featureTimeline: {
    tag: '주요 기능',
    title: '6대 운영 흐름을 한 시스템에서',
    cols: [
      { title: '민원관리',     items: ['접수', '배정', '처리', '보고'] },
      { title: '근태·휴가',    items: ['출퇴근', '휴가신청', '결재', '서명'] },
      { title: '차량·GPS',     items: ['배차', '실시간 추적', '도착확인', '주행 기록'] },
      { title: '산업안전보건', items: ['TBM', '안전점검', '보고서', '결재'] },
      { title: '실적·통계',    items: ['수집량', '운행', '인력', '지자체 보고서'] },
      { title: '관리자 콘솔',  items: ['NOC 56″', '권한 매트릭스', '감사 로그'] },
    ],
  },

  /* ─── 13~19 Feature 7종 ─── */
  features: {
    /* 13 민원관리 */
    complaints: {
      tag: '민원관리',
      titleLine1: '접수부터 지자체 보고까지',
      titleLine2: '한 화면, 한 흐름.',
      body: '시민 민원 접수 → 운전원 배정 → 처리 → 지자체 보고를 한 흐름으로 자동화. 미처리 민원은 처리기한 초과 시점에 NOC와 알림센터에서 자동 알림됩니다.',
      bullets: ['전화·웹·시민앱 3채널 통합 접수', '관할 위탁업체·운전원 자동 배정', '처리 사진·도착확인 자동 첨부', '지자체 양식 자동 출력'],
      mockTitle: '민원관리',
      mocks: [
        { title: '대형폐기물 #2026-0428',     status: '처리중',   statusKind: 'warn',    loc: `${EXAMPLE_MUNI.primary.district} ${EXAMPLE_MUNI.primary.neighborhoods[0]}`, time: '15분 전' },
        { title: '음식물 미수거 #2026-0427',   status: '기한초과', statusKind: 'danger',  loc: `${EXAMPLE_MUNI.primary.district} ${EXAMPLE_MUNI.primary.neighborhoods[1]}`, time: '2일 전' },
        { title: '재활용 분리 위반 #2026-0426', status: '완료',     statusKind: 'success', loc: `${EXAMPLE_MUNI.primary.district} ${EXAMPLE_MUNI.primary.neighborhoods[2]}`, time: '완료' },
      ],
    },
    /* 14 근태·휴가·결재 */
    leave: {
      tag: '근태 · 휴가 · 결재',
      titleLine1: '출퇴근은 모바일로,',
      titleLine2: '결재는 한 줄로.',
      body: '운전원은 폰으로 GPS 출퇴근, 관리자는 한 화면에서 휴가·결재·서명까지 처리. 연차·반차·경조사·가족돌봄 등 11종 휴가 유형을 모두 지원합니다.',
      bullets: ['차고지 GPS 반경 검증 출퇴근', '11종 휴가 유형 + 반차(0.5일) 자동 계산', '2단계 결재 라인 + 전자서명', '월 근태 자동 집계 → 급여 연동'],
      mockTitle: '휴가 신청 대기 (3건)',
      mocks: [
        { worker: '이철수', status: '대기', statusKind: 'warn',    type: '연차',     date: '04.25 · 1일' },
        { worker: '김민준', status: '대기', statusKind: 'warn',    type: '가족돌봄', date: '04.29 · 1일' },
        { worker: '박영희', status: '승인', statusKind: 'success', type: '반차',     date: '05.02 · 0.5일' },
      ],
    },
    /* 15 차량·NOC */
    vehicle: {
      tag: '차량 · 실시간 GPS · NOC',
      titleLine1: '56″ 한 장에',
      titleLine2: '모든 사업장.',
      body: '차고지 출발부터 작업 완료까지 실시간 추적. 56″ 4K NOC 운영센터 화면이 6-Zone Bento 레이아웃으로 출근율·운행차량·민원·수집량·안전·알림을 동시에 시각화합니다.',
      bullets: ['차량별 실시간 GPS + 노선 추적', '자동 폴링 — 30초 주기 데이터 갱신', '정비 이력·점검 일지 자동 저장', '차량 사고·이상 즉시 알림'],
      noc: [
        { label: '출근 현황',   num: '26 / 30',  sub: '정시 24 · 지각 2' },
        { label: '운행 차량',   num: '12 / 14',  sub: '정비중 1 · 대기 1' },
        { label: '미처리 민원', num: '7',         sub: '기한 초과 2',     subColor: '#fca5a5' },
        { label: '금일 수집량', num: '14.2 t',   sub: '전일 +8.4%' },
        { label: '안전 보고',   num: '3',         sub: '미검토 1' },
        { label: '알림',        num: '12',        sub: '긴급 0' },
      ],
    },
    /* 16 산업안전보건 */
    safety: {
      tag: '산업안전보건',
      titleLine1: '무사한 퇴근을 위한',
      titleLine2: '일상의 시스템.',
      body: 'TBM·일상점검·월 보고서·결재까지 자동화. 중대재해처벌법이 요구하는 사전 예방 활동의 기록을 5년간 자동 보존합니다 — 사고 발생 시 즉시 입증 가능.',
      bullets: ['TBM 전자서명 + 사진 첨부', '일·주·월 안전점검 자동 알림', '산업안전보건법 양식 자동 출력', '감사 로그 5년 보존 (법정 의무)'],
      mockTitle: '오늘의 TBM',
      mocks: [
        { title: '음식물 수거 1조',      status: '서명완료',  statusKind: 'success', sub: '07:30 · 김안전 외 4명' },
        { title: '대형폐기물 기동반',    status: '서명 1/3', statusKind: 'warn',    sub: '08:00 · 시작 전' },
        { title: '차량 일상점검',        status: '대기',      statusKind: 'info',    sub: '11가1234' },
      ],
    },
    /* 17 실적·보고서 */
    report: {
      tag: '실적 · 통계 · 보고서',
      titleLine1: '지자체 보고,',
      titleLine2: '클릭 한 번에.',
      body: `일·주·월·분기 실적과 처리량 통계를 자동 집계. ${EXAMPLE_MUNI.primary.name}·${EXAMPLE_MUNI.secondary[0]} 등 각 지자체 전용 양식으로 즉시 출력 — 운영자가 엑셀에 손대는 시간 0.`,
      bullets: ['일/월/분기 자동 집계', '지자체별 보고 양식 사전 등록', '통합·개별 보고서 동시 지원', 'PDF·엑셀·CSV 동시 출력'],
      mockTitle: `${EXAMPLE_MUNI.primary.name} 월간 보고서 — 2026.04`,
      mockRows: [
        { label: '총 수집량',   value: '432.8 t' },
        { label: '운행 차량',   value: '14대 · 12,840 km' },
        { label: '처리 민원',   value: '128건 (기한 초과 0)' },
        { label: '안전사고',     value: '0건' },
      ],
      mockPills: [
        { label: 'PDF 출력',     kind: 'info' },
        { label: '엑셀 출력',    kind: 'info' },
        { label: '지자체 발송', kind: 'success' },
      ],
    },
    /* 18 모바일 워커앱 */
    workerApp: {
      tag: '모바일 워커앱 (PWA)',
      titleLine1: '운전원 손에 들리는',
      titleLine2: '같은 시스템.',
      body: `별도 앱스토어 배포 없이 ${BRAND.serviceUrl} 접속 → 홈화면 추가로 즉시 설치. 운전원은 출퇴근·휴가·작업확인·서명을 폰 하나로, 관리자가 보는 데이터와 100% 동일.`,
      bullets: ['PWA — 앱스토어 심사 없음, 즉시 배포', '고령자·저시력자 고려 (WCAG AAA)', '320px 폭에서도 깨지지 않는 폰트 스케일', '오프라인 캐시 — 차고지 통신 음영 대응'],
      mockTitle: '홈 — 김운전',
      mocks: [
        { title: '출근',     status: '완료 06:55', statusKind: 'success', sub: '차고지 GPS 반경 내 ✓' },
        { title: '오늘 배정', status: '3건',         statusKind: 'info',     sub: '대형폐기물 · 음식물 · 일반 →' },
        { title: 'TBM 서명', status: '대기',         statusKind: 'warn',     sub: '07:30 시작 전 →' },
      ],
    },
    /* 19 슈퍼관리자 콘솔 */
    superAdmin: {
      tag: '슈퍼관리자 콘솔',
      titleLine1: '226개 지자체 권한을',
      titleLine2: '매트릭스 한 장에.',
      body: `${BRAND.company} 운영팀이 신규 위탁업체를 30분 내 셋업할 수 있도록 설계. 지자체별 권한 매트릭스, 거래처 일괄 조회, 차고지 관리, 감사 로그까지 한 콘솔에서 처리.`,
      bullets: ['신규 위탁업체 셋업 마법사 (5단계)', '지자체별 권한 프리셋 3종', 'cross-tenant 데이터 누출 자동 audit', '감사 로그 5년 보존 + 검색'],
      mockTitle: '슈퍼관리자 콘솔 — 권한 매트릭스',
    },
  },

  /* ─── 20 정보보안 ─── */
  security: {
    tag: '정보보안',
    title: '멀티테넌시 격리 + 감사 로그 5년 보존',
    cards: [
      { label: 'Cross-Tenant Isolation', num: '100%',  numSize: '4cqw', body: '모든 쿼리에 contractorId·municipalityId 자동 부착. 분기 1회 cross-tenant 누출 audit 자동 실행 — 다른 회사 데이터는 단 1바이트도 노출되지 않습니다.' },
      { label: 'RBAC',                    num: '5 Role', numSize: '4cqw', body: 'SUPER / MUNI / CONTRACTOR / INTERNAL / WORKER. JWT 기반 세션 + Edge 미들웨어 1차 방어 + API 라우트 2차 방어. MUNI는 조회 전용으로 즉시 403.' },
      { label: 'Audit Retention',         num: '5 년',   numSize: '4cqw', body: '산업안전보건법·중대재해처벌법이 요구하는 5년 보존 의무 충족. 누가·언제·무엇을 했는지 모든 결재·서명·민원 처리가 자동 기록됩니다.' },
    ],
  },

  /* ─── 21 매트릭스 ─── */
  matrix: {
    tag: '주요 기능',
    title: '기능 한눈에 — 6대 카테고리 × 핵심 모듈',
    rows: [
      { cat: '민원관리',         items: ['접수', '배정', '처리', '도착확인', '시민 알림', '지자체 보고'] },
      { cat: '근태·휴가',         items: ['모바일 출퇴근', 'GPS 검증', '휴가 신청·결재', '전자서명', '연차·반차·경조사'] },
      { cat: '차량·실시간 GPS',  items: ['배차', '실시간 위치', '차량별 정비 이력', 'NOC 6-Zone Bento'] },
      { cat: '산업안전보건',     items: ['TBM', '일상점검', '월/분기 보고서', '결재 라인', '서명 검증'] },
      { cat: '실적·통계',         items: ['일/월/분기', '수집량', '운행 km', '인건비', '지자체 양식 출력'] },
      { cat: '관리자 콘솔',      items: ['226 지자체 권한 매트릭스', '5 Role RBAC', '감사 로그 5년 보존', 'cross-tenant 격리 audit'] },
    ],
  },

  /* ─── 23 도입 4-스텝 ─── */
  steps: {
    tag: '도입 절차',
    title: '14일이면 충분합니다.',
    cards: [
      { n: '01', icon: '⚙', title: '계약·셋업',  body: `계약 체결 후 ${BRAND.company} 운영팀이 지자체 매핑·차고지 등록·CONTRACTOR_ADMIN 계정 발급까지 7일 내 완료.` },
      { n: '02', icon: '⇪', title: '데이터 이전', body: '직원·차량·결재 라인 CSV 일괄 등록. 기존 엑셀이 있다면 그대로 import — 수기 입력 0회.' },
      { n: '03', icon: '✎', title: '교육·시범',   body: '운영자 1일 교육 + 워커앱 1시간 교육. 가짜 데이터로 1주간 시범 운영 후 정식 전환.' },
      { n: '04', icon: '▶', title: '정식 개시',   body: `실제 데이터로 운영 시작. ${BRAND.company} 운영팀이 첫 1개월 핸즈온 지원, 분기 1회 정기 점검.` },
    ],
  },

  /* ─── 25 요금제 ─── */
  pricing: {
    tag: '요금제',
    title: '계정당 요금 — 사업장 인원이 늘어나도 부담 없이',
    headers: { tier: '등록 계정 (최대)', amt: '월 요금 (VAT 별도)' },
    rows: [
      { tier: '~ 30 계정',  amt: '300,000원',   badge: null },
      { tier: '~ 50 계정',  amt: '500,000원',   badge: null },
      { tier: '~ 100 계정', amt: '900,000원',   badge: '10% 할인' },
      { tier: '~ 200 계정', amt: '1,600,000원', badge: '20% 할인' },
      { tier: '~ 300 계정', amt: '2,250,000원', badge: '25% 할인' },
    ],
    side: {
      tag: '300 계정 이상',
      title: '광역단체·대형 위탁업체 맞춤 요금',
      body: '광역지자체 다중 위탁, 1,000 계정 이상 대형 위탁업체는 별도 협의 — 멀티테넌시 격리 옵션, 전용 NOC 환경, SLA 보증 포함.',
      cta: '→ 도입문의',
    },
    footnote: '※ 계정 요금제 = 사업장 상시 근로자 수가 아닌 CleanERP에 등록된 계정 수 기준 · 신규 도입 첫 1개월 무료',
  },

  /* ─── 27 연락처 ─── */
  contact: {
    tag: `CLEANERP · BY ${BRAND.companyUpper}`,
    titleLine1: '지금 바로',
    titleLine2: '상담을 시작하세요.',
    body: '시연 데모 30분 · 도입 컨설팅 무료 · 첫 1개월 무료 운영. 멀티테넌시 격리·5년 감사 보존·56″ NOC를 직접 보여드립니다.',
    rows: [
      { label: 'TEL',  value: BRAND.contactTel,   link: false },
      { label: 'WEB',  value: BRAND.serviceUrl,   link: true  },
      { label: 'MAIL', value: BRAND.contactEmail, link: false },
      { label: 'OPS',  value: BRAND.contactOps,   link: false },
    ],
  },

  /* ─── 28 Thank You ─── */
  thanks: {
    topPre: '운영은 어렵지만,',
    topAccent: 'CleanERP는 쉽습니다.',
    center: 'THANK YOU',
    brand: BRAND.brandLine,
  },
} as const;
