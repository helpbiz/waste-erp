import './intro.css';
import PrintButton from './_print-button';

export const metadata = {
  title: 'CleanERP — 생활폐기물 수집운반업을 위한 운영·안전 통합 ERP',
  description: '226개 지자체와 위탁업체가 함께 쓰는 운영·안전 통합 ERP — CleanERP 서비스 소개서',
};

/* Step 2 산출물: 표지 + 목차 + 챕터 1 디바이더 + 챕터 1 첫 컨텐츠.
   사용자 결정 — 안 3 듀얼 포지셔닝 / 브랜드 표기 CleanERP 단독.
   /intro 라우트는 root layout 상속 — 인증 무관 공개 페이지. */

const TOC = [
  { num: '01', label: '개발 배경', en: 'The Why', page: '04' },
  { num: '02', label: 'CleanERP 소개', en: 'About', page: '08' },
  { num: '03', label: '주요 기능', en: 'Features', page: '12' },
  { num: '04', label: '도입 절차', en: 'Onboarding', page: '24' },
  { num: '05', label: '요금제', en: 'Pricing', page: '26' },
  { num: '06', label: '도입 문의', en: 'Contact', page: '28' },
];

const PAIN_POINTS = [
  {
    headline: '수기·엑셀에 묶인 운영',
    icon: '01',
    emphasis: '담당자 퇴사 = 업무 단절',
    body: '엑셀 파일이 PC 한 대에 갇히고, 카톡으로 흩어진 지시는 추적 불가. 담당자가 떠나면 데이터도 함께 사라집니다.',
  },
  {
    headline: '쏟아지는 지자체 보고',
    icon: '02',
    emphasis: '월 30종+ 보고 양식',
    body: '일일 수집량·민원 처리·차량 운행·인력 출근 — 보고 양식만 30종을 넘는데, 1인 운영 사무실로는 정리할 시간조차 부족합니다.',
  },
  {
    headline: '중대재해법 사각지대',
    icon: '03',
    emphasis: '운전원 사고 = 사업주 형사처벌',
    body: 'TBM·안전점검 기록이 없으면 면책 불가. 그러나 출퇴근부터 작업 종료까지의 안전 활동을 종이로 관리하는 한, 입증 자체가 어렵습니다.',
  },
];

export default function IntroPage() {
  return (
    <main className="intro-deck">
      <header className="intro-toolbar">
        <span>CleanERP / Brochure v0.1 — 표지·목차·챕터 1</span>
        <PrintButton />
      </header>

      {/* SLIDE 1 — 표지 */}
      <section className="slide slide-dark slide-cover" aria-label="표지">
        <div className="cover-tag">226개 지자체와 위탁업체가 함께 쓰는</div>

        <div>
          <h1 className="cover-headline">
            운영은 <span className="accent">자동화</span>하고,<br />
            안전은 <span className="accent">시스템</span>으로 지킵니다.
          </h1>
          <div className="cover-divider" />
          <div className="cover-brand">
            CleanERP<span className="cover-brand-dot" />
          </div>
          <div className="cover-tagline">
            생활폐기물 수집운반업을 위한 운영·안전 통합 ERP
          </div>
        </div>

        <div className="cover-helpbiz">HELPBIZ · 2026</div>
      </section>

      {/* SLIDE 2 — 목차 */}
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

      {/* SLIDE 3 — 챕터 1 디바이더 */}
      <section className="slide slide-dark slide-chapter" aria-label="챕터 1 — 개발 배경">
        <div className="chapter-en">CHAPTER 01 · THE WHY</div>
        <div className="chapter-num">
          01<span className="chapter-num-slash">/06</span>
        </div>
        <h2 className="chapter-title">개발 배경</h2>
        <p className="chapter-sub">
          왜 지금 생활폐기물 수집운반업에 통합 ERP가 필요한가 — 1인 운영 사무실의 현실,
          쏟아지는 지자체 보고, 그리고 중대재해처벌법이 만든 새로운 책임 구조.
        </p>
        <div className="slide-num">03</div>
      </section>

      {/* SLIDE 4 — 3대 통증 */}
      <section className="slide slide-light slide-pain" aria-label="3대 통증">
        <span className="pain-tag">개발 배경</span>
        <h2 className="pain-title">
          생활폐기물 수집운반업의 3대 운영 통증
        </h2>
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
        <div className="pain-footer">
          수기 관리의 한계 <span className="arrow">→</span> 통합 ERP 전환은 이제 선택이 아닌 생존 조건
        </div>
        <div className="slide-num">04</div>
      </section>
    </main>
  );
}
