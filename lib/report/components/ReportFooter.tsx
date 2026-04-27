// Design Ref: §3.4 — footer.signatures + metadata
import type { ReportFooterSpec, ReportData } from '../spec-types';

export function ReportFooter({ spec, data }: { spec: ReportFooterSpec; data: ReportData }) {
  return (
    <footer className="report-footer">
      {spec.signatures && spec.signatures.length > 0 && (
        <div className="report-footer__signatures">
          {spec.signatures.map((s, i) => (
            <div
              key={i}
              className="report-footer__sign"
              style={{ width: s.width ?? 200 }}
            >
              <div className="report-footer__sign-label">{s.label}</div>
              <div className="report-footer__sign-line">(서명/날인)</div>
            </div>
          ))}
        </div>
      )}
      {spec.metadata && spec.metadata.length > 0 && (
        <div className="report-footer__meta">
          {spec.metadata.map((m, i) => (
            <span key={i} className="report-footer__meta-item">
              {m.label}: {substitute(m.value, data)}
            </span>
          ))}
        </div>
      )}
    </footer>
  );
}

function substitute(template: string, data: ReportData): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const trimmed = String(expr).trim();
    const [pathRaw, filterRaw] = trimmed.split('|').map((s) => s.trim());
    const value = readPath(pathRaw, data);
    if (filterRaw && filterRaw.startsWith('format(')) {
      const m = /format\(['"]([^'"]+)['"]\)/.exec(filterRaw);
      if (m) return formatDate(value, m[1], data.header.date);
    }
    return value == null ? '' : String(value);
  });
}

function readPath(path: string, data: ReportData): unknown {
  if (path === 'date') return data.header.date;
  if (path === 'now') return data.meta.generatedAt;
  if (path === 'user.name') return data.meta.generatedBy.name;
  return undefined;
}

function formatDate(value: unknown, fmt: string, fallback: string): string {
  const iso = typeof value === 'string' ? value : fallback;
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (isNaN(d.getTime())) return String(value ?? '');
  const pad = (n: number) => String(n).padStart(2, '0');
  const tokens: Record<string, string> = {
    YYYY: String(d.getUTCFullYear()),
    MM: pad(d.getUTCMonth() + 1),
    DD: pad(d.getUTCDate()),
    HH: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
    ddd: ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()],
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ddd/g, (t) => tokens[t] ?? t);
}
