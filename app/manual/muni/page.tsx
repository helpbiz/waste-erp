import Link from 'next/link';
import '../manual.css';
import PrintButton from '../_components/PrintButton';
import RoleBadge from '../_components/RoleBadge';
import Chapter from '../_components/Chapter';
import { MANUAL_META } from '../_config';
import { MUNI_META, MUNI_CHAPTERS } from '../_content/muni';

export const metadata = {
  title: `${MUNI_META.title} — ${MANUAL_META.title}`,
  description: MUNI_META.subtitle,
};

export default function MuniManual() {
  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · {MANUAL_META.lastUpdated}</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="지자체관리자 매뉴얼 PDF" />
        </div>
      </header>

      <div className="manual-container">
        <header className="manual-page-header">
          <div className="manual-page-eyebrow"><RoleBadge role="muni" /></div>
          <h1 className="manual-page-title">{MUNI_META.title}</h1>
          <p className="manual-page-lead">{MUNI_META.welcome}</p>
        </header>

        {MUNI_CHAPTERS.map((ch) => (
          <Chapter key={ch.num} ch={ch} />
        ))}

        <footer style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p style={{ marginBottom: 8 }}><strong style={{ color: '#0f172a' }}>{MANUAL_META.brand}</strong> · {MANUAL_META.domain}</p>
          <p>{MUNI_META.title} · {MANUAL_META.version} · {MANUAL_META.lastUpdated}</p>
          <p style={{ marginTop: 12 }}><Link href="/manual">← 매뉴얼 메인으로</Link></p>
        </footer>
      </div>
    </main>
  );
}
