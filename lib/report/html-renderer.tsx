// Design Ref: §2.1 lib/report/html-renderer — renderToStaticMarkup → 인쇄용 HTML
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReportSpec, ReportData } from './spec-types';
import { ReportPage } from './components/ReportPage';

const REPORT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #0f172a; }
  .report-page { padding: 0; font-size: 10pt; }

  .report-header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
  .report-header__row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .report-header__logo { object-fit: contain; }
  .report-header__title { margin: 0; font-size: 16pt; font-weight: 800; flex: 1; text-align: center; }
  .report-header__meta { width: 100%; border-collapse: collapse; }
  .report-header__meta th { background: #f1f5f9; font-weight: 700; font-size: 9pt; padding: 4px 8px; border: 1px solid #cbd5e1; text-align: left; width: 90px; }
  .report-header__meta td { padding: 4px 8px; border: 1px solid #cbd5e1; font-size: 9pt; }

  .report-summary { margin: 12px 0; }
  .report-summary__grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .report-summary__card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; text-align: center; background: #f8fafc; }
  .report-summary__card--total { background: #cffafe; border-color: #0e7490; }
  .report-summary__label { font-size: 9pt; color: #475569; margin-bottom: 4px; }
  .report-summary__value { font-size: 14pt; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #0f172a; }
  .report-summary__unit { font-size: 9pt; font-weight: 600; color: #64748b; margin-left: 2px; }

  .report-table { margin-top: 12px; }
  .report-table table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .report-table th { background: #1e3a5f; color: white; padding: 6px 4px; font-weight: 700; border: 1px solid #1e3a5f; }
  .report-table td { padding: 5px 6px; border: 1px solid #cbd5e1; vertical-align: middle; }
  .report-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .report-table__empty { text-align: center; padding: 24px !important; color: #64748b; font-style: italic; }
  .report-table tfoot td { background: #f1f5f9; font-weight: 800; }
  .report-table__footer-label { text-align: right; padding-right: 8px !important; }

  .report-footer { margin-top: 16px; }
  .report-footer__signatures { display: flex; gap: 24px; justify-content: flex-end; margin-bottom: 12px; }
  .report-footer__sign { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
  .report-footer__sign-label { font-size: 9pt; font-weight: 700; margin-bottom: 24px; }
  .report-footer__sign-line { font-size: 8pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
  .report-footer__meta { font-size: 8pt; color: #475569; text-align: right; }
  .report-footer__meta-item { margin-left: 12px; }
`;

export function renderReportHtml(spec: ReportSpec, data: ReportData): string {
  const body = renderToStaticMarkup(<ReportPage spec={spec} data={data} />);
  const orientation = spec.page.orientation === 'landscape' ? 'landscape' : 'portrait';
  const margin = spec.page.margin || '10mm';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(spec.header.title)} - ${data.header.date}</title>
  <style>
    @page { size: ${spec.page.format} ${orientation}; margin: ${margin}; }
    ${REPORT_CSS}
  </style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
