import { Fragment } from 'react';
import './intro.css';
import PrintButton from './_print-button';

export const metadata = {
  title: 'CleanERP — 생활폐기물 수집운반업을 위한 운영·안전 통합 ERP',
  description: '226개 지자체와 위탁업체가 함께 쓰는 운영·안전 통합 ERP — CleanERP 서비스 소개서',
};

/* ──────────────────────────────────────────────────────────
   CleanERP 서비스 소개서 (v0.2 — 26 슬라이드 풀 deck)
   - 사용자 결정: 듀얼 포지셔닝(운영+안전), CleanERP 단독 브랜드.
   - 디자인 톤: 무사퇴근 PDF 디자인 시스템 차용 + helpbiz 시안 액센트.
   - 인쇄 시 슬라이드당 1페이지 (1280×720) PDF 출력.
   ────────────────────────────────────────────────────────── */

const TOC = [
  { num: '01', label: '개발 배경',       en: 'The Why',     page: '04' },
  { num: '02', label: 'CleanERP 소개',   en: 'About',       page: '08' },
  { num: '03', label: '주요 기능',       en: 'Features',    page: '12' },
  { num: '04', label: '도입 절차',       en: 'Onboarding',  page: '22' },
  { num: '05', label: '요금제',          en: 'Pricing',     page: '24' },
  { num: '06', label: '도입 문의',       en: 'Contact',     page: '26' },
];

const PAIN_POINTS = [
  { headline: '수기·엑셀에 묶인 운영', icon: '01', emphasis: '담당자 퇴사 = 업무 단절', body: '엑셀 파일이 PC 한 대에 갇히고, 카톡으로 흩어진 지시는 추적 불가. 담당자가 떠나면 데이터도 함께 사라집니다.' },
  { headline: '쏟아지는 지자체 보고',   icon: '02', emphasis: '월 30종+ 보고 양식',     body: '일일 수집량·민원 처리·차량 운행·인력 출근 — 보고 양식만 30종을 넘는데, 1인 운영 사무실로는 정리할 시간조차 부족합니다.' },
  { headline: '중대재해법 사각지대',     icon: '03', emphasis: '운전원 사고 = 사업주 형사처벌', body: 'TBM·안전점검 기록이 없으면 면책 불가. 그러나 출퇴근부터 작업 종료까지의 안전 활동을 종이로 관리하는 한, 입증 자체가 어렵습니다.' },
];

const STATS = [
  { label: 'Multi-Tenancy',  num: '226', unit: '지자체', body: '전국 226개 시·군·구가 사전 시드되어 신규 위탁업체 셋업 시 즉시 매핑 — 광역단체부터 1개구 위탁업체까지 단일 인스턴스 위에서 동시 운영됩니다.' },
  { label: 'Roles',           num: '5',    unit: '단계',  body: '운영사·지자체·회사·내부팀장·근로자 — 5단계 RBAC. 한 사람이 한 Role을 갖고, 한 Role은 보이는 화면이 다릅니다.' },
  { label: 'Mobile-First',    num: '100', unit: '%',    body: '운전원·수거원·기동반 — 현장 인력 전원 모바일 PWA. 별도 앱스토어 배포 없이 즉시 사용 가능, 56″ NOC와 동일한 데이터를 공유합니다.' },
];

const ROLES = [
  { depth: 0, key: 'SUPER_ADMIN',      name: '시스템관리자',  desc: '플랫폼 전체 운영 (helpbiz)' },
  { depth: 1, key: 'MUNI_ADMIN',       name: '지자체관리자',  desc: '관할 위탁업체 모니터링·보고서 조회' },
  { depth: 2, key: 'CONTRACTOR_ADMIN', name: '회사관리자',     desc: '위탁업체 대표 — 회사 운영 총괄' },
  { depth: 3, key: 'INTERNAL_ADMIN',   name: '일반관리자',     desc: '팀장·실장·안전관리자 — 결재·배차·민원 배정' },
  { depth: 4, key: 'WORKER',           name: '일반근로자',     desc: '운전원·수거원 — 모바일 출퇴근·작업·서명' },
];

const FEATURE_TIMELINE = [
  { title: '민원관리',     items: ['접수', '배정', '처리', '보고'] },
  { title: '근태·휴가',    items: ['출퇴근', '휴가신청', '결재', '서명'] },
  { title: '차량·GPS',     items: ['배차', '실시간 추적', '도착확인', '주행 기록'] },
  { title: '산업안전보건', items: ['TBM', '안전점검', '보고서', '결재'] },
  { title: '실적·통계',    items: ['수집량', '운행', '인력', '지자체 보고서'] },
  { title: '관리자 콘솔',  items: ['NOC 56″', '권한 매트릭스', '감사 로그'] },
];

const MATRIX = [
  { cat: '민원관리',         items: ['접수', '배정', '처리', '도착확인', '시민 알림', '지자체 보고'] },
  { cat: '근태·휴가',        items: ['모바일 출퇴근', 'GPS 검증', '휴가 신청·결재', '전자서명', '연차·반차·경조사'] },
  { cat: '차량·실시간 GPS',  items: ['배차', '실시간 위치', '차량별 정비 이력', 'NOC 6-Zone Bento'] },
  { cat: '산업안전보건',     items: ['TBM', '일상점검', '월/분기 보고서', '결재 라인', '서명 검증'] },
  { cat: '실적·통계',        items: ['일/월/분기', '수집량', '운행 km', '인건비', '지자체 양식 출력'] },
  { cat: '관리자 콘솔',      items: ['226 지자체 권한 매트릭스', '5 Role RBAC', '감사 로그 5년 보존', 'cross-tenant 격리 audit'] },
];

const STEPS = [
  { n: '01', icon: '⚙', title: '계약·셋업',  body: '계약 체결 후 helpbiz 운영팀이 지자체 매핑·차고지 등록·CONTRACTOR_ADMIN 계정 발급까지 7일 내 완료.' },
  { n: '02', icon: '⇪', title: '데이터 이전', body: '직원·차량·결재 라인 CSV 일괄 등록. 기존 엑셀이 있다면 그대로 import — 수기 입력 0회.' },
  { n: '03', icon: '✎', title: '교육·시범',   body: '운영자 1일 교육 + 워커앱 1시간 교육. 가짜 데이터로 1주간 시범 운영 후 정식 전환.' },
  { n: '04', icon: '▶', title: '정식 개시',   body: '실제 데이터로 운영 시작. helpbiz 운영팀이 첫 1개월 핸즈온 지원, 분기 1회 정기 점검.' },
];

const PRICING = [
  { tier: '~ 30 계정',   amt: '300,000원',      badge: null },
  { tier: '~ 50 계정',   amt: '500,000원',      badge: null },
  { tier: '~ 100 계정',  amt: '900,000원',      badge: '10% 할인' },
  { tier: '~ 200 계정',  amt: '1,600,000원',    badge: '20% 할인' },
  { tier: '~ 300 계정',  amt: '2,250,000원',    badge: '25% 할인' },
];

export default function IntroPage() {
  return (
    <main className="intro-deck">
      <header className="intro-toolbar">
        <span>CleanERP / Brochure v0.3 — 27 slides</span>
        <PrintButton />
      </header>

      {/* ─── 01 표지 ─── */}
      <section className="slide slide-dark slide-cover" aria-label="표지">
        <div className="cover-tag">226개 지자체와 위탁업체가 함께 쓰는</div>
        <div>
          <h1 className="cover-headline">
            운영은 <span className="accent">자동화</span>하고,<br />
            안전은 <span className="accent">시스템</span>으로 지킵니다.
          </h1>
          <div className="cover-divider" />
          <div className="cover-brand">CleanERP<span className="cover-brand-dot" /></div>
          <div className="cover-tagline">생활폐기물 수집운반업을 위한 운영·안전 통합 ERP</div>
        </div>
        <div className="cover-helpbiz">HELPBIZ · 2026</div>
      </section>

      {/* ─── 02 목차 ─── */}
      <section className="slide slide-dark slide-toc" aria-label="목차">
        <h2 className="toc-title">목차</h2>
        <ol className="toc-list">
          {TOC.map((it) => (
            <li className="toc-item" key={it.num}>
              <span className="toc-num">{it.num}</span>
              <span className="toc-label">{it.label}</span>
              <span className="toc-page">{it.page}</span>
            </li>
          ))}
        </ol>
        <div className="slide-num">02</div>
      </section>

      {/* ─── 03 챕터 1 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 1">
        <div className="chapter-en">CHAPTER 01 · THE WHY</div>
        <div className="chapter-num">01<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">개발 배경</h2>
        <p className="chapter-sub">왜 지금 생활폐기물 수집운반업에 통합 ERP가 필요한가 — 1인 운영 사무실의 현실, 쏟아지는 지자체 보고, 그리고 중대재해처벌법이 만든 새로운 책임 구조.</p>
        <div className="slide-num">03</div>
      </section>

      {/* ─── 04 3대 통증 ─── */}
      <section className="slide slide-light slide-pain" aria-label="3대 통증">
        <span className="pain-tag">개발 배경</span>
        <h2 className="pain-title">생활폐기물 수집운반업의 3대 운영 통증</h2>
        <div className="pain-grid">
          {PAIN_POINTS.map((p) => (
            <article className="pain-card" key={p.headline}>
              <div className="pain-card-hero">
                <span className="pain-card-icon" aria-hidden>{p.icon}</span>
                <div className="pain-card-headline">{p.headline}</div>
              </div>
              <div className="pain-card-emphasis">{p.emphasis}</div>
              <div className="pain-card-body">{p.body}</div>
            </article>
          ))}
        </div>
        <div className="pain-footer">수기 관리의 한계 <span className="arrow">→</span> 통합 ERP 전환은 이제 선택이 아닌 생존 조건</div>
        <div className="slide-num">04</div>
      </section>

      {/* ─── 05 통계 ─── */}
      <section className="slide slide-light slide-stat" aria-label="통계">
        <span className="pain-tag">개발 배경</span>
        <h2 className="pain-title">한 시스템에 담아낸 폐기물 수집운반업의 운영 구조</h2>
        <div className="stat-grid">
          {STATS.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-num">{s.num}<span className="unit">{s.unit}</span></div>
              <div className="stat-card-body">{s.body}</div>
            </div>
          ))}
        </div>
        <div className="stat-source">출처: CleanERP 시드 데이터·내부 운영 통계 (2026 기준)</div>
        <div className="slide-num">05</div>
      </section>

      {/* ─── 06 Before / After ─── */}
      <section className="slide slide-light slide-compare" aria-label="전환의 그림">
        <span className="pain-tag">개발 배경</span>
        <h2 className="pain-title">수기를 시스템으로, 분산을 통합으로</h2>
        <div className="compare-grid">
          <div className="compare-side before">
            <div className="compare-label">BEFORE</div>
            <div className="compare-headline">엑셀·카톡·종이로 흩어진 운영</div>
            <ul className="compare-list">
              <li>출퇴근은 종이 출근부 + 사진 카톡</li>
              <li>민원은 전화·문자로 받아 종이에 메모</li>
              <li>차량 위치는 전화로 확인</li>
              <li>지자체 보고는 매월 엑셀로 수기 작성</li>
              <li>안전점검은 종이로 보관 — 입증 어려움</li>
            </ul>
          </div>
          <div className="compare-arrow">→</div>
          <div className="compare-side after">
            <div className="compare-label">AFTER · CLEANERP</div>
            <div className="compare-headline">한 시스템에서 운영도 안전도</div>
            <ul className="compare-list">
              <li>모바일 GPS 출퇴근 + 자동 집계</li>
              <li>민원 접수→배정→처리→보고 자동 흐름</li>
              <li>NOC 56″ 화면에서 전 차량 실시간 추적</li>
              <li>지자체 보고서 클릭 한 번으로 자동 생성</li>
              <li>TBM·안전점검 전자서명 + 5년 감사 보존</li>
            </ul>
          </div>
        </div>
        <div className="slide-num">06</div>
      </section>

      {/* ─── 07 챕터 2 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 2">
        <div className="chapter-en">CHAPTER 02 · ABOUT</div>
        <div className="chapter-num">02<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">CleanERP 소개</h2>
        <p className="chapter-sub">helpbiz가 운영하는 멀티테넌트 ERP — 226개 지자체와 N개 위탁업체가 한 인스턴스 위에서 데이터 격리된 채 동시 운영됩니다. 5단계 Role 체계로 권한이 정확히 분리됩니다.</p>
        <div className="slide-num">07</div>
      </section>

      {/* ─── 08 helpbiz + 핵심 숫자 ─── */}
      <section className="slide slide-light slide-stat" aria-label="helpbiz 소개">
        <span className="pain-tag">CleanERP 소개</span>
        <h2 className="pain-title">helpbiz가 만드는, 폐기물 수집운반업 전용 ERP</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-label">Operating Company</div>
            <div className="stat-card-num" style={{ fontSize: '3cqw' }}>helpbiz</div>
            <div className="stat-card-body">생활폐기물 수집운반업 1인 운영 사무실의 현실에서 출발 — 영세 위탁업체도 30분 내 신규 셋업 가능한 단순함을 설계 원칙으로 합니다.</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Domain Focus</div>
            <div className="stat-card-num" style={{ fontSize: '3cqw' }}>WCI 전용</div>
            <div className="stat-card-body">범용 ERP가 아닌 생활폐기물 수집운반업(Waste Collection Industry) 전용 — 민원·차량·실적·안전 도메인을 한 시스템에 녹였습니다.</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Service URL</div>
            <div className="stat-card-num" style={{ fontSize: '2.4cqw' }}>wci.helpbiz.kr</div>
            <div className="stat-card-body">웹 + PWA 모바일 단일 도메인. 운영자는 데스크톱 콘솔, 운전원은 폰 — 별도 앱 설치 없이 같은 URL.</div>
          </div>
        </div>
        <div className="slide-num">08</div>
      </section>

      {/* ─── 09 5단계 Role ─── */}
      <section className="slide slide-light slide-roles" aria-label="5단계 Role">
        <span className="pain-tag">CleanERP 소개</span>
        <h2 className="pain-title">5단계 Role — 보이는 화면이 직책에 따라 달라집니다</h2>
        <div className="role-tree">
          {ROLES.map((r) => (
            <div className="role-row" data-depth={r.depth} key={r.key}>
              <div className="role-pill">
                <span className="role-pill-key">{r.key}</span>
                <span className="role-pill-name">{r.name}</span>
              </div>
              <span className="role-pill-desc">{r.desc}</span>
            </div>
          ))}
        </div>
        <div className="slide-num">09</div>
      </section>

      {/* ─── 10 멀티테넌시 ─── */}
      <section className="slide slide-light slide-tenancy" aria-label="멀티테넌시">
        <span className="pain-tag">CleanERP 소개</span>
        <h2 className="pain-title">한 시스템, 226개 지자체 × N개 위탁업체 — 데이터는 절대 섞이지 않습니다</h2>
        <div className="tenancy-canvas">
          <div className="tenancy-col">
            <div className="tenancy-col-title">지자체</div>
            <div className="tenancy-box">강남구청 <span className="count">226</span></div>
            <div className="tenancy-box">송파구청</div>
            <div className="tenancy-box">밀양시 시설관리공단</div>
            <div className="tenancy-box">기장군 도시관리공단</div>
            <div className="tenancy-arrow">⋮</div>
          </div>
          <div className="tenancy-hub">
            CleanERP
            <div className="sub">SINGLE INSTANCE · MULTI-TENANT</div>
          </div>
          <div className="tenancy-col">
            <div className="tenancy-col-title">위탁업체</div>
            <div className="tenancy-box">강남청소(주) <span className="count">N</span></div>
            <div className="tenancy-box">송파환경(주)</div>
            <div className="tenancy-box">㈜밀양위생</div>
            <div className="tenancy-box">기장환경산업</div>
            <div className="tenancy-arrow">⋮</div>
          </div>
        </div>
        <div className="slide-num">10</div>
      </section>

      {/* ─── 11 챕터 3 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 3">
        <div className="chapter-en">CHAPTER 03 · FEATURES</div>
        <div className="chapter-num">03<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">주요 기능</h2>
        <p className="chapter-sub">민원 접수부터 지자체 보고까지, 출퇴근부터 안전점검까지 — 폐기물 수집운반업이 매일 반복하는 6대 운영 흐름을 한 시스템에서 자동화합니다.</p>
        <div className="slide-num">11</div>
      </section>

      {/* ─── 12 6대 카테고리 타임라인 ─── */}
      <section className="slide slide-light slide-timeline" aria-label="6대 카테고리">
        <span className="pain-tag">주요 기능</span>
        <h2 className="pain-title">6대 운영 흐름을 한 시스템에서</h2>
        <div className="timeline-grid">
          {FEATURE_TIMELINE.map((c) => (
            <div className="timeline-col" key={c.title}>
              <div className="timeline-col-title">{c.title}</div>
              <div className="timeline-dot" />
              <ul className="timeline-list">
                {c.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="slide-num">12</div>
      </section>

      {/* ─── 13 민원관리 ─── */}
      <section className="slide slide-light slide-feature" aria-label="민원관리">
        <div className="feat-text">
          <span className="feat-tag">민원관리</span>
          <h2 className="feat-title">접수부터 지자체 보고까지<br />한 화면, 한 흐름.</h2>
          <p className="feat-body">시민 민원 접수 → 운전원 배정 → 처리 → 지자체 보고를 한 흐름으로 자동화. 미처리 민원은 처리기한 초과 시점에 NOC와 알림센터에서 자동 알림됩니다.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">전화·웹·시민앱 3채널 통합 접수</div>
            <div className="feat-bullet">관할 위탁업체·운전원 자동 배정</div>
            <div className="feat-bullet">처리 사진·도착확인 자동 첨부</div>
            <div className="feat-bullet">지자체 양식 자동 출력</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">민원관리</div>
              <div className="mock-card">
                <div className="mock-row"><strong>대형폐기물 #2026-0428</strong><span className="mock-pill warn">처리중</span></div>
                <div className="mock-row"><span className="muted">강남구 역삼동</span><span className="muted">15분 전</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>음식물 미수거 #2026-0427</strong><span className="mock-pill danger">기한초과</span></div>
                <div className="mock-row"><span className="muted">강남구 삼성동</span><span className="muted">2일 전</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>재활용 분리 위반 #2026-0426</strong><span className="mock-pill success">완료</span></div>
                <div className="mock-row"><span className="muted">강남구 청담동</span><span className="muted">완료</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">13</div>
      </section>

      {/* ─── 14 근태·휴가·결재 ─── */}
      <section className="slide slide-light slide-feature" aria-label="근태·휴가">
        <div className="feat-text">
          <span className="feat-tag">근태 · 휴가 · 결재</span>
          <h2 className="feat-title">출퇴근은 모바일로,<br />결재는 한 줄로.</h2>
          <p className="feat-body">운전원은 폰으로 GPS 출퇴근, 관리자는 한 화면에서 휴가·결재·서명까지 처리. 연차·반차·경조사·가족돌봄 등 11종 휴가 유형을 모두 지원합니다.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">차고지 GPS 반경 검증 출퇴근</div>
            <div className="feat-bullet">11종 휴가 유형 + 반차(0.5일) 자동 계산</div>
            <div className="feat-bullet">2단계 결재 라인 + 전자서명</div>
            <div className="feat-bullet">월 근태 자동 집계 → 급여 연동</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">휴가 신청 대기 (3건)</div>
              <div className="mock-card">
                <div className="mock-row"><strong>이철수</strong><span className="mock-pill warn">대기</span></div>
                <div className="mock-row"><span className="mock-pill info">연차</span><span className="muted">04.25 · 1일</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>김민준</strong><span className="mock-pill warn">대기</span></div>
                <div className="mock-row"><span className="mock-pill info">가족돌봄</span><span className="muted">04.29 · 1일</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>박영희</strong><span className="mock-pill success">승인</span></div>
                <div className="mock-row"><span className="mock-pill info">반차</span><span className="muted">05.02 · 0.5일</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">14</div>
      </section>

      {/* ─── 15 차량 + NOC ─── */}
      <section className="slide slide-light slide-feature" aria-label="차량·NOC">
        <div className="feat-text">
          <span className="feat-tag">차량 · 실시간 GPS · NOC</span>
          <h2 className="feat-title">56″ 한 장에<br />모든 사업장.</h2>
          <p className="feat-body">차고지 출발부터 작업 완료까지 실시간 추적. 56″ 4K NOC 운영센터 화면이 6-Zone Bento 레이아웃으로 출근율·운행차량·민원·수집량·안전·알림을 동시에 시각화합니다.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">차량별 실시간 GPS + 노선 추적</div>
            <div className="feat-bullet">자동 폴링 — 30초 주기 데이터 갱신</div>
            <div className="feat-bullet">정비 이력·점검 일지 자동 저장</div>
            <div className="feat-bullet">차량 사고·이상 즉시 알림</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-noc">
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">출근 현황</div>
              <div className="mock-noc-zone-num">26 / 30</div>
              <div className="mock-noc-zone-sub">정시 24 · 지각 2</div>
            </div>
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">운행 차량</div>
              <div className="mock-noc-zone-num">12 / 14</div>
              <div className="mock-noc-zone-sub">정비중 1 · 대기 1</div>
            </div>
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">미처리 민원</div>
              <div className="mock-noc-zone-num">7</div>
              <div className="mock-noc-zone-sub" style={{ color: '#fca5a5' }}>기한 초과 2</div>
            </div>
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">금일 수집량</div>
              <div className="mock-noc-zone-num">14.2 t</div>
              <div className="mock-noc-zone-sub">전일 +8.4%</div>
            </div>
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">안전 보고</div>
              <div className="mock-noc-zone-num">3</div>
              <div className="mock-noc-zone-sub">미검토 1</div>
            </div>
            <div className="mock-noc-zone">
              <div className="mock-noc-zone-label">알림</div>
              <div className="mock-noc-zone-num">12</div>
              <div className="mock-noc-zone-sub">긴급 0</div>
            </div>
          </div>
        </div>
        <div className="slide-num">15</div>
      </section>

      {/* ─── 16 산업안전보건 ─── */}
      <section className="slide slide-light slide-feature" aria-label="산업안전보건">
        <div className="feat-text">
          <span className="feat-tag">산업안전보건</span>
          <h2 className="feat-title">무사한 퇴근을 위한<br />일상의 시스템.</h2>
          <p className="feat-body">TBM·일상점검·월 보고서·결재까지 자동화. 중대재해처벌법이 요구하는 사전 예방 활동의 기록을 5년간 자동 보존합니다 — 사고 발생 시 즉시 입증 가능.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">TBM 전자서명 + 사진 첨부</div>
            <div className="feat-bullet">일·주·월 안전점검 자동 알림</div>
            <div className="feat-bullet">산업안전보건법 양식 자동 출력</div>
            <div className="feat-bullet">감사 로그 5년 보존 (법정 의무)</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">오늘의 TBM</div>
              <div className="mock-card">
                <div className="mock-row"><strong>음식물 수거 1조</strong><span className="mock-pill success">서명완료</span></div>
                <div className="mock-row"><span className="muted">07:30 · 김안전 외 4명</span><span className="muted">→</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>대형폐기물 기동반</strong><span className="mock-pill warn">서명 1/3</span></div>
                <div className="mock-row"><span className="muted">08:00 · 시작 전</span><span className="muted">→</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>차량 일상점검</strong><span className="mock-pill info">대기</span></div>
                <div className="mock-row"><span className="muted">11가1234</span><span className="muted">→</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">16</div>
      </section>

      {/* ─── 17 실적·통계·보고서 ─── */}
      <section className="slide slide-light slide-feature" aria-label="실적·보고서">
        <div className="feat-text">
          <span className="feat-tag">실적 · 통계 · 보고서</span>
          <h2 className="feat-title">지자체 보고,<br />클릭 한 번에.</h2>
          <p className="feat-body">일·주·월·분기 실적과 처리량 통계를 자동 집계. 강남구청·송파구청 등 각 지자체 전용 양식으로 즉시 출력 — 운영자가 엑셀에 손대는 시간 0.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">일/월/분기 자동 집계</div>
            <div className="feat-bullet">지자체별 보고 양식 사전 등록</div>
            <div className="feat-bullet">통합·개별 보고서 동시 지원</div>
            <div className="feat-bullet">PDF·엑셀·CSV 동시 출력</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-desktop">
            <div className="mock-desktop-bar" />
            <div className="mock-desktop-body">
              <div style={{ fontWeight: 900, fontSize: '1cqw', color: '#0f172a' }}>강남구청 월간 보고서 — 2026.04</div>
              <div className="mock-card">
                <div className="mock-row"><strong>총 수집량</strong><span className="muted">432.8 t</span></div>
                <div className="mock-row"><strong>운행 차량</strong><span className="muted">14대 · 12,840 km</span></div>
                <div className="mock-row"><strong>처리 민원</strong><span className="muted">128건 (기한 초과 0)</span></div>
                <div className="mock-row"><strong>안전사고</strong><span className="muted">0건</span></div>
              </div>
              <div style={{ display: 'flex', gap: '0.6cqw', marginTop: '0.4cqw' }}>
                <span className="mock-pill info">PDF 출력</span>
                <span className="mock-pill info">엑셀 출력</span>
                <span className="mock-pill success">지자체 발송</span>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">17</div>
      </section>

      {/* ─── 18 모바일 워커앱 ─── */}
      <section className="slide slide-light slide-feature" aria-label="모바일 워커앱">
        <div className="feat-text">
          <span className="feat-tag">모바일 워커앱 (PWA)</span>
          <h2 className="feat-title">운전원 손에 들리는<br />같은 시스템.</h2>
          <p className="feat-body">별도 앱스토어 배포 없이 wci.helpbiz.kr 접속 → 홈화면 추가로 즉시 설치. 운전원은 출퇴근·휴가·작업확인·서명을 폰 하나로, 관리자가 보는 데이터와 100% 동일.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">PWA — 앱스토어 심사 없음, 즉시 배포</div>
            <div className="feat-bullet">고령자·저시력자 고려 (WCAG AAA)</div>
            <div className="feat-bullet">320px 폭에서도 깨지지 않는 폰트 스케일</div>
            <div className="feat-bullet">오프라인 캐시 — 차고지 통신 음영 대응</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">홈 — 김운전</div>
              <div className="mock-card">
                <div className="mock-row"><strong>출근</strong><span className="mock-pill success">완료 06:55</span></div>
                <div className="mock-row"><span className="muted">차고지 GPS 반경 내</span><span className="muted">✓</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>오늘 배정</strong><span className="mock-pill info">3건</span></div>
                <div className="mock-row"><span className="muted">대형폐기물 · 음식물 · 일반</span><span className="muted">→</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>TBM 서명</strong><span className="mock-pill warn">대기</span></div>
                <div className="mock-row"><span className="muted">07:30 시작 전</span><span className="muted">→</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">18</div>
      </section>

      {/* ─── 19 슈퍼관리자 콘솔 ─── */}
      <section className="slide slide-light slide-feature" aria-label="슈퍼관리자 콘솔">
        <div className="feat-text">
          <span className="feat-tag">슈퍼관리자 콘솔</span>
          <h2 className="feat-title">226개 지자체 권한을<br />매트릭스 한 장에.</h2>
          <p className="feat-body">helpbiz 운영팀이 신규 위탁업체를 30분 내 셋업할 수 있도록 설계. 지자체별 권한 매트릭스, 거래처 일괄 조회, 차고지 관리, 감사 로그까지 한 콘솔에서 처리.</p>
          <div className="feat-bullets">
            <div className="feat-bullet">신규 위탁업체 셋업 마법사 (5단계)</div>
            <div className="feat-bullet">지자체별 권한 프리셋 3종</div>
            <div className="feat-bullet">cross-tenant 데이터 누출 자동 audit</div>
            <div className="feat-bullet">감사 로그 5년 보존 + 검색</div>
          </div>
        </div>
        <div className="feat-mock">
          <div className="mock-desktop">
            <div className="mock-desktop-bar" />
            <div className="mock-desktop-body">
              <div style={{ fontWeight: 900, fontSize: '1cqw', color: '#0f172a' }}>슈퍼관리자 콘솔 — 권한 매트릭스</div>
              <div className="mock-card">
                <div className="mock-row"><strong>강남구청</strong><span className="mock-pill info">표준 프리셋</span></div>
                <div className="mock-row"><span className="muted">대시보드 · 민원 · 보고서 · 안전</span><span className="muted">DL ✓</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>송파구청</strong><span className="mock-pill info">모니터링 전용</span></div>
                <div className="mock-row"><span className="muted">대시보드만</span><span className="muted">DL ✗</span></div>
              </div>
              <div className="mock-card">
                <div className="mock-row"><strong>밀양시 시설관리공단</strong><span className="mock-pill info">전체 공개</span></div>
                <div className="mock-row"><span className="muted">모든 화면 + bulk DL</span><span className="muted">DL ✓</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">19</div>
      </section>

      {/* ─── 20 정보보안 ─── */}
      <section className="slide slide-light slide-stat" aria-label="정보보안">
        <span className="pain-tag">정보보안</span>
        <h2 className="pain-title">멀티테넌시 격리 + 감사 로그 5년 보존</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-label">Cross-Tenant Isolation</div>
            <div className="stat-card-num" style={{ fontSize: '4cqw' }}>100%</div>
            <div className="stat-card-body">모든 쿼리에 contractorId·municipalityId 자동 부착. 분기 1회 cross-tenant 누출 audit 자동 실행 — 다른 회사 데이터는 단 1바이트도 노출되지 않습니다.</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">RBAC</div>
            <div className="stat-card-num" style={{ fontSize: '4cqw' }}>5 Role</div>
            <div className="stat-card-body">SUPER / MUNI / CONTRACTOR / INTERNAL / WORKER. JWT 기반 세션 + Edge 미들웨어 1차 방어 + API 라우트 2차 방어. MUNI는 조회 전용으로 즉시 403.</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Audit Retention</div>
            <div className="stat-card-num" style={{ fontSize: '4cqw' }}>5 년</div>
            <div className="stat-card-body">산업안전보건법·중대재해처벌법이 요구하는 5년 보존 의무 충족. 누가·언제·무엇을 했는지 모든 결재·서명·민원 처리가 자동 기록됩니다.</div>
          </div>
        </div>
        <div className="slide-num">20</div>
      </section>

      {/* ─── 21 기능 매트릭스 ─── */}
      <section className="slide slide-light slide-matrix" aria-label="기능 매트릭스">
        <span className="pain-tag">주요 기능</span>
        <h2 className="pain-title">기능 한눈에 — 6대 카테고리 × 핵심 모듈</h2>
        <div className="matrix-table">
          {MATRIX.map((row) => (
            <Fragment key={row.cat}>
              <div className="matrix-cat">{row.cat}</div>
              <div className="matrix-list">
                {row.items.map((it) => <span key={it}>{it}</span>)}
              </div>
            </Fragment>
          ))}
        </div>
        <div className="slide-num">21</div>
      </section>

      {/* ─── 22 챕터 4 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 4">
        <div className="chapter-en">CHAPTER 04 · ONBOARDING</div>
        <div className="chapter-num">04<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">도입 절차</h2>
        <p className="chapter-sub">계약부터 정식 운영까지 14일 — 1인 운영 사무실도 부담 없는 4단계 절차. helpbiz 운영팀이 셋업·교육·시범까지 핸즈온 지원합니다.</p>
        <div className="slide-num">22</div>
      </section>

      {/* ─── 23 4-스텝 ─── */}
      <section className="slide slide-light slide-steps" aria-label="도입 4단계">
        <span className="pain-tag">도입 절차</span>
        <h2 className="pain-title">14일이면 충분합니다.</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <div className="step-icon" aria-hidden>{s.icon}</div>
              <div className="step-num">STEP {s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
        <div className="slide-num">23</div>
      </section>

      {/* ─── 24 챕터 5 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 5">
        <div className="chapter-en">CHAPTER 05 · PRICING</div>
        <div className="chapter-num">05<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">요금제</h2>
        <p className="chapter-sub">계정 단위 단순 과금 — 사업장 인원이 늘어나도 부담 없이 확장. 첫 1개월 무료 운영, 광역단체·1,000 계정 이상은 별도 협의.</p>
        <div className="slide-num">24</div>
      </section>

      {/* ─── 25 요금제 본문 ─── */}
      <section className="slide slide-light slide-pricing" aria-label="요금제">
        <span className="pain-tag">요금제</span>
        <h2 className="pain-title">계정당 요금 — 사업장 인원이 늘어도 부담 없이</h2>
        <div className="pricing-grid">
          <div className="pricing-table">
            <div className="pricing-thead">
              <span>등록 계정 (최대)</span>
              <span>월 요금 (VAT 별도)</span>
            </div>
            {PRICING.map((p) => (
              <div className="pricing-row" key={p.tier}>
                <span className="pricing-tier">{p.tier}</span>
                <span className="pricing-amt">
                  {p.amt}
                  {p.badge && <span className="badge">{p.badge}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="pricing-side">
            <div className="pricing-side-tag">300 계정 이상</div>
            <div className="pricing-side-title">광역단체·대형 위탁업체 맞춤 요금</div>
            <div className="pricing-side-body">광역지자체 다중 위탁, 1,000 계정 이상 대형 위탁업체는 별도 협의 — 멀티테넌시 격리 옵션, 전용 NOC 환경, SLA 보증 포함.</div>
            <div className="pricing-side-cta">→ 도입문의</div>
          </div>
        </div>
        <div className="pricing-foot">※ 계정 요금제 = 사업장 상시 근로자 수가 아닌 CleanERP에 등록된 계정 수 기준 · 신규 도입 첫 1개월 무료</div>
        <div className="slide-num">25</div>
      </section>

      {/* ─── 26 챕터 6 디바이더 ─── */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 6">
        <div className="chapter-en">CHAPTER 06 · CONTACT</div>
        <div className="chapter-num">06<span className="chapter-num-slash">/06</span></div>
        <h2 className="chapter-title">도입 문의</h2>
        <p className="chapter-sub">생활폐기물 수집운반업의 운영·안전 통합 관리, 지금 시작하세요. 첫 미팅에서 30분 내 신규 위탁업체 셋업 시연을 보실 수 있습니다.</p>
        <div className="slide-num">26</div>
      </section>

      {/* ─── 27 연락처 ─── */}
      <section className="slide slide-dark slide-contact" aria-label="연락처">
        <div className="contact-left">
          <div className="contact-tag">CLEANERP · BY HELPBIZ</div>
          <h2 className="contact-title">지금 바로<br />상담을 시작하세요.</h2>
          <p className="contact-body">시연 데모 30분 · 도입 컨설팅 무료 · 첫 1개월 무료 운영. 멀티테넌시 격리·5년 감사 보존·56″ NOC를 직접 보여드립니다.</p>
        </div>
        <div className="contact-card">
          <div className="contact-row">
            <span className="contact-row-label">TEL</span>
            <span className="contact-row-value">02-XXXX-XXXX</span>
          </div>
          <div className="contact-row">
            <span className="contact-row-label">WEB</span>
            <span className="contact-row-value"><a href="https://wci.helpbiz.kr">wci.helpbiz.kr</a></span>
          </div>
          <div className="contact-row">
            <span className="contact-row-label">MAIL</span>
            <span className="contact-row-value">contact@helpbiz.kr</span>
          </div>
          <div className="contact-row">
            <span className="contact-row-label">OPS</span>
            <span className="contact-row-value">평일 09:00 — 18:00</span>
          </div>
        </div>
        <div className="slide-num" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>27</div>
      </section>

      {/* ─── 28 Thank You ─── */}
      <section className="slide slide-dark slide-thanks" aria-label="감사합니다">
        <div className="thanks-top">
          운영은 어렵지만,<br />
          <span className="accent">CleanERP는 쉽습니다.</span>
        </div>
        <div className="thanks-center">THANK YOU</div>
        <div className="thanks-brand">CleanERP · helpbiz</div>
      </section>
    </main>
  );
}
