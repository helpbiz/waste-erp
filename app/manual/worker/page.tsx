import Link from 'next/link';
import '../manual.css';
import PrintButton from '../_components/PrintButton';
import RoleBadge from '../_components/RoleBadge';
import Chapter from '../_components/Chapter';
import { MANUAL_META } from '../_config';
import { WORKER_META, WORKER_CHAPTERS } from '../_content/worker';

export const metadata = {
  title: `${WORKER_META.title} — ${MANUAL_META.title}`,
  description: WORKER_META.subtitle,
};

export default function WorkerManual() {
  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · {MANUAL_META.lastUpdated}</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="근로자 매뉴얼 PDF" />
        </div>
      </header>

      <div className="manual-container">
        <header className="manual-page-header">
          <div className="manual-page-eyebrow"><RoleBadge role="worker" /></div>
          <h1 className="manual-page-title">{WORKER_META.title}</h1>
          <p className="manual-page-lead">{WORKER_META.welcome}</p>
        </header>

        {WORKER_CHAPTERS.map((ch) => (
          <Chapter key={ch.num} ch={ch} />
        ))}

        <footer style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p style={{ marginBottom: 8 }}><strong style={{ color: '#0f172a' }}>{MANUAL_META.brand}</strong> · {MANUAL_META.domain}</p>
          <p>{WORKER_META.title} · {MANUAL_META.version} · {MANUAL_META.lastUpdated}</p>
          <p style={{ marginTop: 12 }}><Link href="/manual">← 매뉴얼 메인으로</Link></p>
        </footer>
      </div>
    </main>
  );
}
