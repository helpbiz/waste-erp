import { Fragment } from 'react';
import './intro.css';
import PrintButton from './_print-button';
import { EXAMPLE_MUNI, EXAMPLE_CONTRACTORS, EXAMPLE_PRESETS } from './_config';
import { COPY } from './_content';

export const metadata = {
  title: 'CleanERP — 생활폐기물 수집운반업을 위한 운영·안전 통합 ERP',
  description: '226개 지자체와 위탁업체가 함께 쓰는 운영·안전 통합 ERP — CleanERP 서비스 소개서',
};

/* ──────────────────────────────────────────────────────────
   CleanERP 서비스 소개서 — 27 슬라이드 풀 deck.

   ▣ 디자인  : 이 파일 (JSX 구조 + 클래스)
   ▣ 가변 데이터: _config.ts (브랜드·예시 지자체·연락처)
   ▣ 슬라이드 카피: _content.ts (모든 텍스트)

   원칙: 카피 수정 시 _content.ts 만 건드린다. 디자인은 이 파일만.
   ────────────────────────────────────────────────────────── */

export default function IntroPage() {
  const C = COPY;

  return (
    <main className="intro-deck">
      <header className="intro-toolbar">
        <span>{C.toolbar}</span>
        <PrintButton />
      </header>

      {/* ─── 01 표지 ─── */}
      <section className="slide slide-dark slide-cover" aria-label="표지">
        <div className="cover-tag">{C.cover.tag}</div>
        <div>
          <h1 className="cover-headline">
            {C.cover.headline.line1.pre}<span className="accent">{C.cover.headline.line1.accent}</span>{C.cover.headline.line1.post}<br />
            {C.cover.headline.line2.pre}<span className="accent">{C.cover.headline.line2.accent}</span>{C.cover.headline.line2.post}
          </h1>
          <div className="cover-divider" />
          <div className="cover-brand">CleanERP<span className="cover-brand-dot" /></div>
          <div className="cover-tagline">{C.cover.tagline}</div>
        </div>
        <div className="cover-helpbiz">{C.toolbar.split(' / ')[0]} · {C.cover.footerYear}</div>
      </section>

      {/* ─── 02 목차 ─── */}
      <section className="slide slide-dark slide-toc" aria-label="목차">
        <h2 className="toc-title">{C.toc.title}</h2>
        <ol className="toc-list">
          {C.toc.items.map((it) => (
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
      <ChapterSlide n={1} num="03" />

      {/* ─── 04 3대 통증 ─── */}
      <section className="slide slide-light slide-pain" aria-label="3대 통증">
        <span className="pain-tag">{C.pain.tag}</span>
        <h2 className="pain-title">{C.pain.title}</h2>
        <div className="pain-grid">
          {C.pain.cards.map((p) => (
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
        <div className="pain-footer">{C.pain.footer.left} <span className="arrow">{C.pain.footer.arrow}</span> {C.pain.footer.right}</div>
        <div className="slide-num">04</div>
      </section>

      {/* ─── 05 통계 ─── */}
      <section className="slide slide-light slide-stat" aria-label="통계">
        <span className="pain-tag">{C.stat.tag}</span>
        <h2 className="pain-title">{C.stat.title}</h2>
        <div className="stat-grid">
          {C.stat.cards.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-num">{s.num}<span className="unit">{s.unit}</span></div>
              <div className="stat-card-body">{s.body}</div>
            </div>
          ))}
        </div>
        <div className="stat-source">{C.stat.source}</div>
        <div className="slide-num">05</div>
      </section>

      {/* ─── 06 Before / After ─── */}
      <section className="slide slide-light slide-compare" aria-label="전환의 그림">
        <span className="pain-tag">{C.compare.tag}</span>
        <h2 className="pain-title">{C.compare.title}</h2>
        <div className="compare-grid">
          <div className="compare-side before">
            <div className="compare-label">{C.compare.before.label}</div>
            <div className="compare-headline">{C.compare.before.headline}</div>
            <ul className="compare-list">
              {C.compare.before.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
          <div className="compare-arrow">{C.compare.arrow}</div>
          <div className="compare-side after">
            <div className="compare-label">{C.compare.after.label}</div>
            <div className="compare-headline">{C.compare.after.headline}</div>
            <ul className="compare-list">
              {C.compare.after.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
        </div>
        <div className="slide-num">06</div>
      </section>

      {/* ─── 07 챕터 2 디바이더 ─── */}
      <ChapterSlide n={2} num="07" />

      {/* ─── 08 운영사 + 핵심 숫자 ─── */}
      <section className="slide slide-light slide-stat" aria-label="운영사 소개">
        <span className="pain-tag">{C.about.tag}</span>
        <h2 className="pain-title">{C.about.title}</h2>
        <div className="stat-grid">
          {C.about.cards.map((card) => (
            <div className="stat-card" key={card.label}>
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-num" style={{ fontSize: card.valueSize }}>{card.value}</div>
              <div className="stat-card-body">{card.body}</div>
            </div>
          ))}
        </div>
        <div className="slide-num">08</div>
      </section>

      {/* ─── 09 5단계 Role ─── */}
      <section className="slide slide-light slide-roles" aria-label="5단계 Role">
        <span className="pain-tag">{C.roles.tag}</span>
        <h2 className="pain-title">{C.roles.title}</h2>
        <div className="role-tree">
          {C.roles.rows.map((r) => (
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
        <span className="pain-tag">{C.tenancy.tag}</span>
        <h2 className="pain-title">{C.tenancy.title}</h2>
        <div className="tenancy-canvas">
          <div className="tenancy-col">
            <div className="tenancy-col-title">{C.tenancy.leftColTitle}</div>
            <div className="tenancy-box">{EXAMPLE_MUNI.primary.name} <span className="count">{C.tenancy.primaryMuniCount}</span></div>
            {EXAMPLE_MUNI.secondary.slice(0, 3).map((m) => (
              <div className="tenancy-box" key={m}>{m}</div>
            ))}
            <div className="tenancy-arrow">{C.tenancy.arrow}</div>
          </div>
          <div className="tenancy-hub">
            {C.tenancy.hub.name}
            <div className="sub">{C.tenancy.hub.sub}</div>
          </div>
          <div className="tenancy-col">
            <div className="tenancy-col-title">{C.tenancy.rightColTitle}</div>
            <div className="tenancy-box">{EXAMPLE_CONTRACTORS[0]} <span className="count">{C.tenancy.primaryContractorCount}</span></div>
            {EXAMPLE_CONTRACTORS.slice(1).map((c) => (
              <div className="tenancy-box" key={c}>{c}</div>
            ))}
            <div className="tenancy-arrow">{C.tenancy.arrow}</div>
          </div>
        </div>
        <div className="slide-num">10</div>
      </section>

      {/* ─── 11 챕터 3 디바이더 ─── */}
      <ChapterSlide n={3} num="11" />

      {/* ─── 12 6대 카테고리 타임라인 ─── */}
      <section className="slide slide-light slide-timeline" aria-label="6대 카테고리">
        <span className="pain-tag">{C.featureTimeline.tag}</span>
        <h2 className="pain-title">{C.featureTimeline.title}</h2>
        <div className="timeline-grid">
          {C.featureTimeline.cols.map((c) => (
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
        <FeatureText feat={C.features.complaints} />
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">{C.features.complaints.mockTitle}</div>
              {C.features.complaints.mocks.map((m) => (
                <div className="mock-card" key={m.title}>
                  <div className="mock-row"><strong>{m.title}</strong><span className={`mock-pill ${m.statusKind}`}>{m.status}</span></div>
                  <div className="mock-row"><span className="muted">{m.loc}</span><span className="muted">{m.time}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="slide-num">13</div>
      </section>

      {/* ─── 14 근태·휴가·결재 ─── */}
      <section className="slide slide-light slide-feature" aria-label="근태·휴가">
        <FeatureText feat={C.features.leave} />
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">{C.features.leave.mockTitle}</div>
              {C.features.leave.mocks.map((m) => (
                <div className="mock-card" key={m.worker}>
                  <div className="mock-row"><strong>{m.worker}</strong><span className={`mock-pill ${m.statusKind}`}>{m.status}</span></div>
                  <div className="mock-row"><span className="mock-pill info">{m.type}</span><span className="muted">{m.date}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="slide-num">14</div>
      </section>

      {/* ─── 15 차량 + NOC ─── */}
      <section className="slide slide-light slide-feature" aria-label="차량·NOC">
        <FeatureText feat={C.features.vehicle} />
        <div className="feat-mock">
          <div className="mock-noc">
            {C.features.vehicle.noc.map((z) => (
              <div className="mock-noc-zone" key={z.label}>
                <div className="mock-noc-zone-label">{z.label}</div>
                <div className="mock-noc-zone-num">{z.num}</div>
                <div className="mock-noc-zone-sub" style={'subColor' in z ? { color: z.subColor } : undefined}>{z.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="slide-num">15</div>
      </section>

      {/* ─── 16 산업안전보건 ─── */}
      <section className="slide slide-light slide-feature" aria-label="산업안전보건">
        <FeatureText feat={C.features.safety} />
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">{C.features.safety.mockTitle}</div>
              {C.features.safety.mocks.map((m) => (
                <div className="mock-card" key={m.title}>
                  <div className="mock-row"><strong>{m.title}</strong><span className={`mock-pill ${m.statusKind}`}>{m.status}</span></div>
                  <div className="mock-row"><span className="muted">{m.sub}</span><span className="muted">→</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="slide-num">16</div>
      </section>

      {/* ─── 17 실적·통계·보고서 ─── */}
      <section className="slide slide-light slide-feature" aria-label="실적·보고서">
        <FeatureText feat={C.features.report} />
        <div className="feat-mock">
          <div className="mock-desktop">
            <div className="mock-desktop-bar" />
            <div className="mock-desktop-body">
              <div style={{ fontWeight: 900, fontSize: '1cqw', color: '#0f172a' }}>{C.features.report.mockTitle}</div>
              <div className="mock-card">
                {C.features.report.mockRows.map((r) => (
                  <div className="mock-row" key={r.label}><strong>{r.label}</strong><span className="muted">{r.value}</span></div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.6cqw', marginTop: '0.4cqw' }}>
                {C.features.report.mockPills.map((p) => (
                  <span className={`mock-pill ${p.kind}`} key={p.label}>{p.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="slide-num">17</div>
      </section>

      {/* ─── 18 모바일 워커앱 ─── */}
      <section className="slide slide-light slide-feature" aria-label="모바일 워커앱">
        <FeatureText feat={C.features.workerApp} />
        <div className="feat-mock">
          <div className="mock-phone">
            <div className="mock-phone-screen">
              <div className="mock-phone-status" />
              <div className="mock-phone-h">{C.features.workerApp.mockTitle}</div>
              {C.features.workerApp.mocks.map((m) => (
                <div className="mock-card" key={m.title}>
                  <div className="mock-row"><strong>{m.title}</strong><span className={`mock-pill ${m.statusKind}`}>{m.status}</span></div>
                  <div className="mock-row"><span className="muted">{m.sub}</span><span className="muted">{m.title === '출근' ? '✓' : '→'}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="slide-num">18</div>
      </section>

      {/* ─── 19 슈퍼관리자 콘솔 ─── */}
      <section className="slide slide-light slide-feature" aria-label="슈퍼관리자 콘솔">
        <FeatureText feat={C.features.superAdmin} />
        <div className="feat-mock">
          <div className="mock-desktop">
            <div className="mock-desktop-bar" />
            <div className="mock-desktop-body">
              <div style={{ fontWeight: 900, fontSize: '1cqw', color: '#0f172a' }}>{C.features.superAdmin.mockTitle}</div>
              {EXAMPLE_PRESETS.map((p) => (
                <div className="mock-card" key={p.muni}>
                  <div className="mock-row"><strong>{p.muni}</strong><span className="mock-pill info">{p.preset}</span></div>
                  <div className="mock-row"><span className="muted">{p.scope}</span><span className="muted">DL {p.dl}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="slide-num">19</div>
      </section>

      {/* ─── 20 정보보안 ─── */}
      <section className="slide slide-light slide-stat" aria-label="정보보안">
        <span className="pain-tag">{C.security.tag}</span>
        <h2 className="pain-title">{C.security.title}</h2>
        <div className="stat-grid">
          {C.security.cards.map((c) => (
            <div className="stat-card" key={c.label}>
              <div className="stat-card-label">{c.label}</div>
              <div className="stat-card-num" style={{ fontSize: c.numSize }}>{c.num}</div>
              <div className="stat-card-body">{c.body}</div>
            </div>
          ))}
        </div>
        <div className="slide-num">20</div>
      </section>

      {/* ─── 21 기능 매트릭스 ─── */}
      <section className="slide slide-light slide-matrix" aria-label="기능 매트릭스">
        <span className="pain-tag">{C.matrix.tag}</span>
        <h2 className="pain-title">{C.matrix.title}</h2>
        <div className="matrix-table">
          {C.matrix.rows.map((row) => (
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
      <ChapterSlide n={4} num="22" />

      {/* ─── 23 4-스텝 ─── */}
      <section className="slide slide-light slide-steps" aria-label="도입 4단계">
        <span className="pain-tag">{C.steps.tag}</span>
        <h2 className="pain-title">{C.steps.title}</h2>
        <div className="steps-grid">
          {C.steps.cards.map((s) => (
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
      <ChapterSlide n={5} num="24" />

      {/* ─── 25 요금제 본문 ─── */}
      <section className="slide slide-light slide-pricing" aria-label="요금제">
        <span className="pain-tag">{C.pricing.tag}</span>
        <h2 className="pain-title">{C.pricing.title}</h2>
        <div className="pricing-grid">
          <div className="pricing-table">
            <div className="pricing-thead">
              <span>{C.pricing.headers.tier}</span>
              <span>{C.pricing.headers.amt}</span>
            </div>
            {C.pricing.rows.map((p) => (
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
            <div className="pricing-side-tag">{C.pricing.side.tag}</div>
            <div className="pricing-side-title">{C.pricing.side.title}</div>
            <div className="pricing-side-body">{C.pricing.side.body}</div>
            <div className="pricing-side-cta">{C.pricing.side.cta}</div>
          </div>
        </div>
        <div className="pricing-foot">{C.pricing.footnote}</div>
        <div className="slide-num">25</div>
      </section>

      {/* ─── 26 챕터 6 디바이더 ─── */}
      <ChapterSlide n={6} num="26" />

      {/* ─── 27 연락처 ─── */}
      <section className="slide slide-dark slide-contact" aria-label="연락처">
        <div className="contact-left">
          <div className="contact-tag">{C.contact.tag}</div>
          <h2 className="contact-title">{C.contact.titleLine1}<br />{C.contact.titleLine2}</h2>
          <p className="contact-body">{C.contact.body}</p>
        </div>
        <div className="contact-card">
          {C.contact.rows.map((r) => (
            <div className="contact-row" key={r.label}>
              <span className="contact-row-label">{r.label}</span>
              <span className="contact-row-value">
                {r.link ? <a href={`https://${r.value}`}>{r.value}</a> : r.value}
              </span>
            </div>
          ))}
        </div>
        <div className="slide-num" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>27</div>
      </section>

      {/* ─── 28 Thank You ─── */}
      <section className="slide slide-dark slide-thanks" aria-label="감사합니다">
        <div className="thanks-top">
          {C.thanks.topPre}<br />
          <span className="accent">{C.thanks.topAccent}</span>
        </div>
        <div className="thanks-center">{C.thanks.center}</div>
        <div className="thanks-brand">{C.thanks.brand}</div>
      </section>
    </main>
  );
}

/* 챕터 디바이더 — 1~6 모두 동일 구조이므로 컴포넌트화. */
function ChapterSlide({ n, num }: { n: 1 | 2 | 3 | 4 | 5 | 6; num: string }) {
  const ch = COPY.chapters[n];
  return (
    <section className="slide slide-dark slide-chapter" aria-label={`챕터 ${n}`}>
      <div className="chapter-en">{ch.en}</div>
      <div className="chapter-num">{ch.num}<span className="chapter-num-slash">{COPY.chapters.total}</span></div>
      <h2 className="chapter-title">{ch.title}</h2>
      <p className="chapter-sub">{ch.sub}</p>
      <div className="slide-num">{num}</div>
    </section>
  );
}

/* feature split 슬라이드 좌측 텍스트 영역 — 13~19 공통. */
function FeatureText({
  feat,
}: {
  feat: { tag: string; titleLine1: string; titleLine2: string; body: string; bullets: readonly string[] };
}) {
  return (
    <div className="feat-text">
      <span className="feat-tag">{feat.tag}</span>
      <h2 className="feat-title">{feat.titleLine1}<br />{feat.titleLine2}</h2>
      <p className="feat-body">{feat.body}</p>
      <div className="feat-bullets">
        {feat.bullets.map((b) => <div className="feat-bullet" key={b}>{b}</div>)}
      </div>
    </div>
  );
}
