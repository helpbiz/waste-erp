// Design Ref: §2.1 — 단일 React 페이지 (renderToStaticMarkup 대상)
import type { ReportSpec, ReportData } from '../spec-types';
import { ReportHeader } from './ReportHeader';
import { ReportSummaryCards } from './ReportSummaryCards';
import { ReportTable } from './ReportTable';
import { ReportFooter } from './ReportFooter';

export function ReportPage({ spec, data }: { spec: ReportSpec; data: ReportData }) {
  return (
    <div className="report-page">
      <ReportHeader spec={spec.header} data={data} />
      {spec.summary && <ReportSummaryCards spec={spec.summary} data={data} />}
      <ReportTable spec={spec.table} data={data} rootSpec={spec} />
      {spec.footer && <ReportFooter spec={spec.footer} data={data} />}
    </div>
  );
}
