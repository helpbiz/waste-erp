// Design Ref: §3.4 — summary.cards (groupBy materialCategory)
import type { ReportSummarySpec, ReportData } from '../spec-types';

export function ReportSummaryCards({
  spec,
  data,
}: {
  spec: ReportSummarySpec;
  data: ReportData;
}) {
  const unit = spec.metric.unit ?? '';
  return (
    <section className="report-summary">
      <div className="report-summary__grid">
        {data.summary.map((s) => (
          <div key={s.category} className="report-summary__card">
            <div className="report-summary__label">{s.label}</div>
            <div className="report-summary__value">
              {fmtWeight(s.totalTon)}
              <span className="report-summary__unit">{unit}</span>
            </div>
          </div>
        ))}
        <div className="report-summary__card report-summary__card--total">
          <div className="report-summary__label">합계</div>
          <div className="report-summary__value">
            {fmtWeight(data.totals.weightTon)}
            <span className="report-summary__unit">{unit}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function fmtWeight(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(3);
}
