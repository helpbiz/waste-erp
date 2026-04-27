'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', ADJUSTED: '조정됨',
};
const WORK_TYPE_LABEL: Record<string, string> = {
  NORMAL: '정상', EARLY: '조기출근', EXTENDED: '연장', NIGHT: '야간', HOLIDAY: '휴일', ON_DUTY: '당직',
};

type Row = {
  workerId: string; workerName: string; employeeNo: string | null;
  positionLabel: string | null; departmentName: string | null;
  recordId: string | null; checkInTime: string | null; checkOutTime: string | null;
  workType: string | null; zoneName: string | null; status: string | null;
};

export default function AttendanceClient({
  date, rows, summary, canManage,
}: {
  date: string;
  rows: Row[];
  summary: { total: number; checkedIn: number; checkedOut: number; notCheckedIn: number; earlyLeave: number; pendingApproval: number };
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);

  function changeDate(v: string) {
    setSelectedDate(v);
    router.push(`/attendance?date=${v}`);
  }

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">근태관리</h2>
        <input type="date" value={selectedDate} onChange={(e) => changeDate(e.target.value)}
          aria-label="기준일"
          className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        <button onClick={() => changeDate(new Date().toISOString().slice(0, 10))}
          className="px-3 py-1.5 rounded border border-line bg-white text-xs font-bold hover:bg-slate-50">오늘</button>
      </div>

      {/* 6 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard label="전체" value={summary.total} unit="명" />
        <KpiCard label="출근" value={summary.checkedIn} unit="명" tone="success" />
        <KpiCard label="퇴근" value={summary.checkedOut} unit="명" tone="accent" />
        <KpiCard label="미출근" value={summary.notCheckedIn} unit="명" tone="warning" />
        <KpiCard label="조퇴" value={summary.earlyLeave} unit="명" tone="early" />
        <KpiCard label="결재 대기" value={summary.pendingApproval} unit="건" tone="warning" />
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-sm font-extrabold text-ink">
          근태 일별 현황 ({selectedDate})
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="근태 일별 현황 표">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-[11px] font-mono font-extrabold text-slate-700 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">직원</th>
              <th className="px-3 py-2 text-left">부서</th>
              <th className="px-3 py-2 text-left">직책</th>
              <th className="px-3 py-2 text-left">출근</th>
              <th className="px-3 py-2 text-left">퇴근</th>
              <th className="px-3 py-2 text-left">유형</th>
              <th className="px-3 py-2 text-left">구역</th>
              <th className="px-3 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">근로자가 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.workerId} className={`hover:bg-slate-50 ${!r.checkInTime ? 'bg-amber-50/30' : ''}`}>
                <td className="px-3 py-2">
                  <div className="font-extrabold text-ink">{r.workerName}</div>
                  <div className="text-[10px] font-mono text-slate-600">{r.employeeNo ?? '—'}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.departmentName ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.positionLabel ?? '—'}</td>
                <td className="px-3 py-2 font-mono font-extrabold text-base">
                  {r.checkInTime ? <span className="text-emerald-700">{fmtTime(r.checkInTime)}</span> : <span className="text-amber-600">—</span>}
                </td>
                <td className="px-3 py-2 font-mono font-extrabold text-base">
                  {r.checkOutTime ? <span className="text-accent">{fmtTime(r.checkOutTime)}</span> : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-3 py-2 text-xs font-bold">{r.workType ? WORK_TYPE_LABEL[r.workType] ?? r.workType : '—'}</td>
                <td className="px-3 py-2 text-xs">{r.zoneName ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.status ? (
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded border-2 ${
                      r.status === 'APPROVED' ? 'bg-emerald-200 text-emerald-900 border-emerald-600' :
                      r.status === 'REJECTED' ? 'bg-red-200 text-red-900 border-red-500' :
                      r.status === 'ADJUSTED' ? 'bg-blue-200 text-blue-900 border-blue-500' :
                      'bg-amber-200 text-amber-900 border-amber-500'
                    }`}>{STATUS_LABEL[r.status]}</span>
                  ) : <span className="text-[10px] font-mono text-slate-500">미기록</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {canManage && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs font-bold text-amber-800">
          💡 근태 조정/승인은 워커앱에서 출근 등록 후, 관리자가 일별 조회하여 처리합니다.
          상세 조정·반려는 추후 cycle에서 모달로 추가 예정입니다.
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, unit, tone = 'default' }: { label: string; value: number; unit: string; tone?: 'default' | 'accent' | 'success' | 'warning' | 'early' }) {
  const colors: Record<string, string> = {
    default: 'bg-white border-slate-400 text-ink',
    accent: 'bg-cyan-100 border-cyan-500 text-cyan-900',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    warning: 'bg-amber-100 border-amber-500 text-amber-900',
    early: 'bg-orange-100 border-orange-500 text-orange-900',
  };
  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${colors[tone]} shadow-sm`}>
      <div className="text-[13px] font-extrabold tracking-tight">{label}</div>
      <div className="font-black mt-1"><span className="text-3xl">{value}</span> <span className="text-sm font-bold">{unit}</span></div>
    </div>
  );
}
