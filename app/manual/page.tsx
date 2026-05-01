import Link from 'next/link';
import './manual.css';
import PrintButton from './_components/PrintButton';
import { ROLES, MANUAL_META } from './_config';

export const metadata = {
  title: `${MANUAL_META.title} — ${MANUAL_META.brand}`,
  description: '근로자·회사관리자·지자체관리자를 위한 CleanERP 사용 안내서. 처음 쓰는 분도 막힘없이.',
};

const FINDER = [
  { q: '폰으로 출퇴근 도장을 찍나요?',                    a: '근로자 매뉴얼' },
  { q: '직원·차량·결재를 관리하는 위치인가요?',           a: '회사관리자 매뉴얼' },
  { q: '관할 위탁업체를 모니터링하는 지자체 직원인가요?', a: '지자체관리자 매뉴얼' },
];

export default function ManualLanding() {
  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · {MANUAL_META.lastUpdated}</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="이 페이지 PDF" />
        </div>
      </header>

      <div className="manual-container">
        {/* Hero */}
        <section className="manual-hero">
          <div className="manual-hero-eyebrow">{MANUAL_META.brand}의 사용자 안내서</div>
          <h1 className="manual-hero-title">{MANUAL_META.title}</h1>
          <p className="manual-hero-subtitle">{MANUAL_META.motto}<br />처음 쓰는 분도, 오래 쓰신 분도 — 자신의 자리에서 막힘없이 사용할 수 있도록 정성껏 정리했습니다.</p>
        </section>

        {/* 역할 카드 */}
        <section className="role-grid">
          {ROLES.map((r) => (
            <Link key={r.key} href={r.route} className="role-card" data-tone={r.tone}>
              <div className="role-card-icon" aria-hidden>{r.glyph}</div>
              <div>
                <div className="role-card-title">{r.label}</div>
                <div className="role-card-subtitle">{r.subtitle}</div>
              </div>
              <ul className="role-card-bullets">
                {r.bullets.map((b) => <li className="role-card-bullet" key={b}>{b}</li>)}
              </ul>
              <div className="role-card-cta">
                매뉴얼 보기 <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </section>

        {/* 역할 찾기 안내 */}
        <section className="role-finder">
          <h2 className="role-finder-title">내 역할은 무엇인가요?</h2>
          <div className="role-finder-list">
            {FINDER.map((f) => (
              <div className="role-finder-item" key={f.q}>
                <span className="role-finder-q">{f.q}</span>
                <span className="role-finder-arrow" aria-hidden>→</span>
                <span className="role-finder-a">{f.a}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 푸터 */}
        <footer style={{ marginTop: 80, paddingTop: 32, borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p style={{ marginBottom: 8 }}><strong style={{ color: '#0f172a' }}>{MANUAL_META.brand}</strong> · {MANUAL_META.domain}</p>
          <p>{MANUAL_META.title} {MANUAL_META.version} · 마지막 업데이트 {MANUAL_META.lastUpdated}</p>
          <p style={{ marginTop: 12, fontSize: 13 }}>매뉴얼 개선 의견은 회사 관리자 또는 {MANUAL_META.brand} 운영팀에 알려주세요.</p>
        </footer>
      </div>
    </main>
  );
}
