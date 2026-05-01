import type { ReactNode } from 'react';

/** 대시보드 KPI 카드 목업 — 큰 숫자 + 라벨 + 부가 정보. */
export default function KpiCardMock({
  label,
  value,
  unit,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  tone?: 'neutral' | 'success' | 'warn' | 'danger';
}) {
  return (
    <div className="mock-kpi" data-tone={tone}>
      <div className="mock-kpi-label">{label}</div>
      <div className="mock-kpi-value">
        {value}
        {unit && <span className="mock-kpi-unit">{unit}</span>}
      </div>
      {sub && <div className="mock-kpi-sub">{sub}</div>}
    </div>
  );
}
