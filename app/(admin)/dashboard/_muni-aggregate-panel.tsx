'use client';

import { useEffect, useState } from 'react';

type ContractorRow = {
  contractorId: string;
  companyName: string;
  users: number;
  todayAttendance: number;
  attendanceRate: number;
  pendingComplaints: number;
  activeVehicles: number;
  safetyReports: number;
};

type AggregateData = {
  municipality: { name: string };
  range: { from: string; to: string };
  contractors: Array<{
    id: string;
    companyName: string;
    users: number;
    attendance: number;
    complaints: number;
    pendingComplaints: number;
    vehicles: number;
    safety: number;
  }>;
  summary: Record<string, number> | null;
};

export default function MuniAggregatePanel() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('all');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch(`/api/super-admin/contractors-aggregate?from=${today}&to=${today}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) {
    return (
      <div className="bg-surface border border-line rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-surface-soft rounded w-1/4 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-soft rounded" />)}
        </div>
      </div>
    );
  }

  if (!data || !data.contractors || data.contractors.length === 0) return null;

  const rows: ContractorRow[] = data.contractors.map((c) => {
    const total = c.users ?? 0;
    const att = c.attendance ?? 0;
    return {
      contractorId: c.id,
      companyName: c.companyName,
      users: total,
      todayAttendance: att,
      attendanceRate: total > 0 ? Math.round((att / total) * 100) : 0,
      pendingComplaints: c.pendingComplaints ?? 0,
      activeVehicles: c.vehicles ?? 0,
      safetyReports: c.safety ?? 0,
    };
  });

  const totals = {
    users: rows.reduce((s, r) => s + r.users, 0),
    todayAttendance: rows.reduce((s, r) => s + r.todayAttendance, 0),
    pendingComplaints: rows.reduce((s, r) => s + r.pendingComplaints, 0),
    activeVehicles: rows.reduce((s, r) => s + r.activeVehicles, 0),
    safetyReports: rows.reduce((s, r) => s + r.safetyReports, 0),
  };
  const totalRate = totals.users > 0 ? Math.round((totals.todayAttendance / totals.users) * 100) : 0;

  const displayRows = selectedId === 'all' ? rows : rows.filter((r) => r.contractorId === selectedId);

  return (
    <section className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-soft">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-sm font-extrabold text-ink">위탁업체 통합 현황</span>
          <span className="text-sm text-ink-muted font-mono">({today} 기준)</span>
        </div>
        {/* 업체 탭 필터 */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <FilterChip active={selectedId === 'all'} onClick={() => setSelectedId('all')}>
            전체 {rows.length}개사
          </FilterChip>
          {rows.map((r) => (
            <FilterChip key={r.contractorId} active={selectedId === r.contractorId} onClick={() => setSelectedId(r.contractorId)}>
              {r.companyName}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* KPI 요약 카드 (전체 선택 시) */}
      {selectedId === 'all' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-b border-line">
          <SummaryCell label="총 인원" value={`${totals.users}명`} tone="default" />
          <SummaryCell
            label="오늘 출근"
            value={`${totals.todayAttendance}명 (${totalRate}%)`}
            tone={totalRate >= 80 ? 'success' : totalRate >= 60 ? 'warn' : 'danger'}
          />
          <SummaryCell
            label="미처리 민원"
            value={`${totals.pendingComplaints}건`}
            tone={totals.pendingComplaints > 0 ? 'warn' : 'success'}
          />
          <SummaryCell label="운행 차량" value={`${totals.activeVehicles}대`} tone="default" />
          <SummaryCell label="안전 보고" value={`${totals.safetyReports}건`} tone={totals.safetyReports > 0 ? 'warn' : 'default'} />
        </div>
      )}

      {/* 업체별 비교 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.6875rem] font-extrabold text-ink-muted bg-surface-soft border-b border-line">
              <th className="text-left px-4 py-2">업체명</th>
              <th className="text-right px-3 py-2">총 인원</th>
              <th className="text-right px-3 py-2">오늘 출근</th>
              <th className="text-right px-3 py-2">출근율</th>
              <th className="text-right px-3 py-2">미처리 민원</th>
              <th className="text-right px-3 py-2">운행 차량</th>
              <th className="text-right px-3 py-2">안전 보고</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => (
              <tr key={r.contractorId} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-soft/40' : ''}`}>
                <td className="px-4 py-2.5 font-bold text-ink">{r.companyName}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{r.users}</td>
                <td className="px-3 py-2.5 text-right font-mono">{r.todayAttendance}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[0.6875rem] font-extrabold ${
                    r.attendanceRate >= 80 ? 'bg-success/10 text-success' :
                    r.attendanceRate >= 60 ? 'bg-amber-100 text-amber-700' :
                    'bg-danger/10 text-danger'
                  }`}>
                    {r.attendanceRate}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {r.pendingComplaints > 0
                    ? <span className="font-extrabold text-amber-600">{r.pendingComplaints}</span>
                    : <span className="text-ink-faint">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{r.activeVehicles}</td>
                <td className="px-3 py-2.5 text-right">
                  {r.safetyReports > 0
                    ? <span className="font-extrabold text-amber-600">{r.safetyReports}</span>
                    : <span className="text-ink-faint">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {selectedId === 'all' && rows.length > 1 && (
            <tfoot>
              <tr className="bg-accent/5 border-t-2 border-accent/20 font-extrabold">
                <td className="px-4 py-2.5 text-accent text-[0.6875rem]">합계 / 평균</td>
                <td className="px-3 py-2.5 text-right font-mono">{totals.users}</td>
                <td className="px-3 py-2.5 text-right font-mono">{totals.todayAttendance}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[0.6875rem] font-extrabold ${
                    totalRate >= 80 ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'
                  }`}>{totalRate}%</span>
                </td>
                <td className="px-3 py-2.5 text-right">{totals.pendingComplaints}</td>
                <td className="px-3 py-2.5 text-right font-mono">{totals.activeVehicles}</td>
                <td className="px-3 py-2.5 text-right">{totals.safetyReports}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 보고서 바로가기 */}
      <div className="flex gap-2 px-4 py-2.5 border-t border-line bg-surface-soft/50">
        <a href="/reports" className="text-[0.6875rem] font-extrabold text-accent hover:underline">📊 통합 보고서 →</a>
        <a href="/dashboard/wall" className="text-[0.6875rem] font-extrabold text-accent hover:underline">🖥 관제모드 →</a>
        <a href="/complaints" className="text-[0.6875rem] font-extrabold text-accent hover:underline">📋 민원관리 →</a>
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-extrabold whitespace-nowrap transition ${
        active ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone: 'default' | 'success' | 'warn' | 'danger' }) {
  const colors = {
    default: 'text-ink',
    success: 'text-success',
    warn: 'text-amber-600',
    danger: 'text-danger',
  };
  return (
    <div className="flex flex-col items-center justify-center px-3 py-3 border-r border-line last:border-0">
      <span className="text-[0.625rem] font-extrabold text-ink-muted mb-0.5">{label}</span>
      <span className={`text-sm font-extrabold ${colors[tone]}`}>{value}</span>
    </div>
  );
}
