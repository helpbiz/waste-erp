// Design Ref: §3.4 — header.title + meta + (optional) logo
import type { ReportHeaderSpec, ReportData } from '../spec-types';

export function ReportHeader({ spec, data }: { spec: ReportHeaderSpec; data: ReportData }) {
  const meta = (spec.meta ?? []).map((m) => ({
    label: m.label,
    value: substitute(m.value, data),
  }));

  return (
    <header className="report-header">
      <div className="report-header__row">
        {spec.left?.type === 'logo' && data.header.contractor.logoUrl && (
          <img
            src={data.header.contractor.logoUrl}
            alt="logo"
            width={spec.left.width ?? 60}
            className="report-header__logo"
          />
        )}
        <h1 className="report-header__title">{spec.title}</h1>
      </div>
      {meta.length > 0 && (
        <table className="report-header__meta">
          <tbody>
            {chunk(meta, 2).map((pair, i) => (
              <tr key={i}>
                {pair.map((m, j) => (
                  <>
                    <th key={`${i}-${j}-label`}>{m.label}</th>
                    <td key={`${i}-${j}-value`}>{m.value}</td>
                  </>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </header>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function substitute(template: string, data: ReportData): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const trimmed = String(expr).trim();
    /* {{date | format(...)}} → 일단 raw date. ddd 같은 한글 요일 필요하면 후속 확장 */
    const [pathRaw, filterRaw] = trimmed.split('|').map((s) => s.trim());
    const value = readPath(pathRaw, data);
    if (filterRaw && filterRaw.startsWith('format(')) {
      return formatValue(value, filterRaw, data.header.date);
    }
    return value == null ? '' : String(value);
  });
}

function readPath(path: string, data: ReportData): unknown {
  /* contractor.companyName / municipality.name / date / now / user.name 지원 */
  if (path === 'date') return data.header.date;
  if (path === 'now') return data.meta.generatedAt;
  if (path === 'user.name') return data.meta.generatedBy.name;
  const segs = path.split('.');
  let cur: unknown = data.header;
  for (const s of segs) {
    if (cur && typeof cur === 'object' && s in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

function formatValue(value: unknown, filterExpr: string, dateRaw: string): string {
  /* 매우 단순한 토큰 치환 — YYYY-MM-DD HH:mm 등 ISO 부분 출력만 */
  const m = /format\(['"]([^'"]+)['"]\)/.exec(filterExpr);
  if (!m) return String(value ?? '');
  const fmt = m[1];
  const iso = typeof value === 'string' ? value : dateRaw;
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
