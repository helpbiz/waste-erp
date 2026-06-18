'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AccessibleConfirmDialog from '@/components/ui/AccessibleConfirmDialog';
import { todayLocalStr } from '@/lib/dates';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', ADJUSTED: '조정됨',
};
const WORK_TYPE_LABEL: Record<string, string> = {
  NORMAL: '정상', EARLY: '조기출근', EXTENDED: '연장', NIGHT: '야간', HOLIDAY: '휴일', ON_DUTY: '당직',
};
const WORK_TYPE_OPTIONS = ['NORMAL', 'EARLY', 'EXTENDED', 'NIGHT', 'HOLIDAY', 'ON_DUTY'] as const;

type Row = {
  workerId: string; workerName: string; employeeNo: string | null;
  positionLabel: string | null; departmentName: string | null;
  recordId: string | null; checkInTime: string | null; checkOutTime: string | null;
  workType: string | null; zoneName: string | null; status: string | null;
};

type SelfRecord = { recordId: string; checkInTime: string | null; checkOutTime: string | null } | null;

type ContractorOpt = { id: string; name: string };

export default function AttendanceClient({
  date, rows, summary, canManage, selfRecord, contractorOpts = [], selectedContractorId = '',
}: {
  date: string;
  rows: Row[];
  summary: { total: number; checkedIn: number; checkedOut: number; notCheckedIn: number; earlyLeave: number; pendingApproval: number };
  canManage: boolean;
  selfRecord?: SelfRecord;
  contractorOpts?: ContractorOpt[];
  selectedContractorId?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);
  const [view, setView] = useState<'daily' | 'adjustments'>('daily');
  const [editing, setEditing] = useState<Row | null>(null);
  const [editingInitTab, setEditingInitTab] = useState<'adjust' | 'history'>('adjust');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleExportExcel() {
    setExporting(true);
    try {
      const ym = selectedDate.slice(0, 7);
      const res = await fetch(`/api/print/attendance-excel?ym=${ym}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `출근대장_${ym}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(false); }
  }

  const todayStr = todayLocalStr();
  const isToday = selectedDate === todayStr;

  // 오늘 날짜 조회 시 60초마다 자동 새로고침
  useEffect(() => {
    if (!isToday) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isToday, router]);

  function changeDate(v: string) {
    setSelectedDate(v);
    const cid = selectedContractorId ? `&contractorId=${selectedContractorId}` : '';
    router.push(`/attendance?date=${v}${cid}`);
  }

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-5">
      {selfRecord !== undefined && <AdminPunchWidget selfRecord={selfRecord} onSuccess={() => router.refresh()} />}
      <div>
        <h2 className="text-xl font-extrabold text-ink">근태관리</h2>
        {/* MUNI_ADMIN 업체 탭 필터 */}
        {contractorOpts.length >= 1 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => router.push(`/attendance?date=${selectedDate}`)}
              className={`px-3 py-1.5 rounded-full text-sm font-extrabold whitespace-nowrap transition ${
                !selectedContractorId ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
              }`}
            >전체 업체</button>
            {contractorOpts.map((c) => (
              <button key={c.id}
                onClick={() => router.push(`/attendance?date=${selectedDate}&contractorId=${c.id}`)}
                className={`px-3 py-1.5 rounded-full text-sm font-extrabold whitespace-nowrap transition ${
                  selectedContractorId === c.id ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
                }`}
              >{c.name}</button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <input type="date" value={selectedDate} onChange={(e) => changeDate(e.target.value)}
            aria-label="기준일"
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold w-[200px]" />
          <button onClick={() => changeDate(todayStr)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50 shrink-0">오늘</button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? '생성 중…' : `${selectedDate.slice(0, 7)} 출근대장 Excel`}
          </button>
          {isToday && (
            <>
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[0.6875rem] font-extrabold border border-green-300 animate-pulse">
                ● 실시간
              </span>
              <button
                onClick={() => { router.refresh(); setLastRefresh(new Date()); }}
                className="px-2.5 py-1 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50"
              >
                새로고침
              </button>
              <span className="text-[0.6875rem] text-ink-muted font-mono">
                최근: {lastRefresh.getHours().toString().padStart(2,'0')}:{lastRefresh.getMinutes().toString().padStart(2,'0')}:{lastRefresh.getSeconds().toString().padStart(2,'0')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 뷰 탭 */}
      <div className="flex gap-0 border-b border-line -mb-1">
        {(['daily', 'adjustments'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-extrabold border-b-2 transition-colors ${
              view === v
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {v === 'daily' ? '일별 현황' : '정정 이력 조회'}
          </button>
        ))}
      </div>

      {view === 'adjustments' && (
        <AdjustmentsTab defaultMonth={selectedDate.slice(0, 7)} />
      )}

      {/* 6 KPI + 일별 테이블 + 모달 — view === 'daily' 에서만 표시 */}
      {view === 'daily' && (<>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard label="전체" value={summary.total} unit="명" />
        <KpiCard label="출근" value={summary.checkedIn} unit="명" tone="success" />
        <KpiCard label="퇴근" value={summary.checkedOut} unit="명" tone="accent" />
        <KpiCard label="미출근" value={summary.notCheckedIn} unit="명" tone="warning" />
        <KpiCard label="조퇴" value={summary.earlyLeave} unit="명" tone="early" />
        <KpiCard
          label="결재 대기"
          value={summary.pendingApproval}
          unit="건"
          tone="warning"
          onClick={canManage ? () => router.push('/approvals') : undefined}
        />
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-sm font-extrabold text-ink">
          근태 일별 현황 ({selectedDate})
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="근태 일별 현황 표">
        <table className="w-full min-w-[640px] text-sm">
          {/* 사용자 요청 2026-04-29: 직원/출근/퇴근/상태만 표시 (부서/직책/유형/구역 컬럼 제거) */}
          <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-ink-muted uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">직원</th>
              <th className="px-3 py-2 text-left">출근</th>
              <th className="px-3 py-2 text-left">퇴근</th>
              <th className="px-3 py-2 text-left">상태</th>
              {canManage && <th className="px-3 py-2 text-left">액션</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-10 text-center text-ink-faint">근로자가 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.workerId} className={`hover:bg-slate-50 ${!r.checkInTime ? 'bg-amber-50/30' : ''}`}>
                <td className="px-3 py-2">
                  <div className="font-extrabold text-ink">{r.workerName}</div>
                </td>
                <td className="px-3 py-2 font-mono font-extrabold text-base">
                  {r.checkInTime ? <span className="text-emerald-700">{fmtTime(r.checkInTime)}</span> : <span className="text-amber-600">—</span>}
                </td>
                <td className="px-3 py-2 font-mono font-extrabold text-base">
                  {r.checkOutTime ? <span className="text-accent">{fmtTime(r.checkOutTime)}</span> : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2">
                  {r.status ? (
                    <span className={`text-sm font-extrabold px-2 py-0.5 rounded border-2 ${
                      r.status === 'APPROVED' ? 'bg-emerald-200 text-emerald-900 border-emerald-600' :
                      r.status === 'REJECTED' ? 'bg-red-200 text-red-900 border-red-500' :
                      r.status === 'ADJUSTED' ? 'bg-blue-200 text-blue-900 border-blue-500' :
                      'bg-amber-200 text-amber-900 border-amber-500'
                    }`}>{STATUS_LABEL[r.status]}</span>
                  ) : <span className="text-sm font-mono text-ink-faint">미기록</span>}
                </td>
                {canManage && (
                  <td className="px-3 py-2">
                    {r.recordId ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setEditing(r); setEditingInitTab('adjust'); }}
                          className="px-3 py-1.5 rounded-md text-sm font-extrabold border-2 border-accent text-accent hover:bg-accent hover:text-white transition active:scale-95"
                        >
                          조정/반려
                        </button>
                        {r.status === 'ADJUSTED' && (
                          <button
                            onClick={() => { setEditing(r); setEditingInitTab('history'); }}
                            title="정정 이력 조회"
                            className="px-2 py-1.5 rounded-md text-sm font-extrabold border-2 border-slate-300 text-ink-faint hover:bg-slate-100 transition active:scale-95"
                          >
                            이력
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[0.625rem] font-mono text-ink-faint">출근 전</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 조정/반려 + 정정 이력 모달 */}
      {editing && editing.recordId && (
        <AdjustModal
          row={editing}
          dateStr={selectedDate}
          defaultTab={editingInitTab}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); router.refresh(); }}
        />
      )}
      </>)}

    </div>
  );
}

/* ─────────────── 조정/반려 모달 ─────────────── */

type AdjustHistoryEntry = {
  id: string;
  adjustedBy: string;
  adjustedByName: string | null;
  adjustmentType: string;
  reason: string;
  original: { checkIn: string | null; checkOut: string | null; workType: string | null };
  adjusted: { checkIn: string | null; checkOut: string | null; workType: string | null };
  createdAt: string;
};

const ADJUSTMENT_TYPE_LABEL: Record<string, string> = {
  CORRECTION: '정정', ADDITION: '추가', DELETION: '삭제', LEAVE: '휴가처리',
};

function HistoryCard({ entry, index }: { entry: AdjustHistoryEntry; index: number }) {
  function fmt(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  return (
    <div className="border border-line rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-mono text-ink-muted">#{index}</span>
          <span className="px-2 py-0.5 rounded text-[0.6875rem] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
            {ADJUSTMENT_TYPE_LABEL[entry.adjustmentType] ?? entry.adjustmentType}
          </span>
        </div>
        <span className="text-[0.6875rem] font-mono text-ink-muted">
          {new Date(entry.createdAt).toLocaleString('ko-KR')}
          {entry.adjustedByName ? ` · ${entry.adjustedByName}` : ''}
        </span>
      </div>
      <div className="text-sm font-bold text-ink bg-amber-50 border border-amber-200 rounded px-3 py-2">
        사유: {entry.reason}
      </div>
      <div className="text-sm font-mono text-ink-muted space-y-0.5">
        <div>출근: {fmt(entry.original.checkIn)} → {fmt(entry.adjusted.checkIn)}</div>
        <div>퇴근: {fmt(entry.original.checkOut)} → {fmt(entry.adjusted.checkOut)}</div>
      </div>
    </div>
  );
}

function AdjustModal({
  row, dateStr, defaultTab = 'adjust', onClose, onSuccess,
}: {
  row: Row;
  dateStr: string;
  defaultTab?: 'adjust' | 'history';
  onClose: () => void;
  onSuccess: () => void;
}) {
  /* HH:MM 추출 */
  function isoToHm(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  /* HH:MM + dateStr → ISO datetime. nextDay=true 시 날짜 +1 (야간 익일 퇴근). */
  function hmToIso(hm: string, nextDay = false): string | null {
    if (!hm) return null;
    const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const base = new Date(`${dateStr}T00:00:00`);
    if (nextDay) base.setDate(base.getDate() + 1);
    const d = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    const local = new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return local.toISOString();
  }

  const [tab, setTab] = useState<'adjust' | 'history'>(defaultTab);
  const [history, setHistory] = useState<{ entries: AdjustHistoryEntry[]; chainOk: boolean } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [checkIn, setCheckIn] = useState(isoToHm(row.checkInTime));
  const [checkOut, setCheckOut] = useState(isoToHm(row.checkOutTime));
  const [workType, setWorkType] = useState<string>(row.workType ?? 'NORMAL');
  /* 야간 출근(20시 이후) + 퇴근 미등록 → 익일 퇴근 자동 제안 */
  const isLikelyNightShift = row.checkInTime ? new Date(row.checkInTime).getHours() >= 20 : false;
  const [checkOutNextDay, setCheckOutNextDay] = useState(isLikelyNightShift && !row.checkOutTime);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmNightReset, setConfirmNightReset] = useState(false);
  const [confirmCheckInReset, setConfirmCheckInReset] = useState(false);

  /* 이력 탭 활성화 시 데이터 조회 */
  useEffect(() => {
    if (tab !== 'history' || !row.recordId || history !== null) return;
    setHistoryLoading(true);
    fetch(`/api/attendance/${row.recordId}/history`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        setHistory({
          entries: d.adjustments ?? [],
          chainOk: d.chain?.verified ?? true,
        });
      })
      .catch(() => setHistory({ entries: [], chainOk: false }))
      .finally(() => setHistoryLoading(false));
  }, [tab, row.recordId, history]);

  const shiftComplete = !!(row.checkInTime && row.checkOutTime);

  const reasonValid = reason.trim().length >= 2;

  async function saveAdjust() {
    if (!reasonValid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/attendance/${row.recordId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustedCheckIn: hmToIso(checkIn),
          adjustedCheckOut: hmToIso(checkOut, checkOutNextDay),
          adjustedWorkType: workType,
          reason: reason.trim(),
          adjustmentType: 'CORRECTION',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '조정 실패');
        return;
      }
      onSuccess();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function doCheckInReset() {
    setConfirmCheckInReset(false);
    if (!reasonValid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/attendance/${row.recordId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustedCheckIn: null,
          reason: reason.trim(),
          adjustmentType: 'CORRECTION',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message ?? data?.error ?? '처리 실패'); return; }
      onSuccess();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function doNightReset() {
    setConfirmNightReset(false);
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/attendance/${row.recordId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustedCheckIn: null,
          reason: `야간 2교대 재출근 활성화 — 오전 기록(${isoToHm(row.checkInTime)}~${isoToHm(row.checkOutTime)}) 조정 이력 보존`,
          adjustmentType: 'CORRECTION',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.message ?? data?.error ?? '처리 실패'); return; }
      onSuccess();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    setConfirmReject(false);
    if (!reasonValid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/attendance/${row.recordId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '반려 실패');
        return;
      }
      onSuccess();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onClose}>
        <div className="w-full max-w-[520px] bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <header className="px-5 pt-4 pb-0 bg-surface-soft border-b-2 border-line">
            <h3 className="text-base font-extrabold text-ink mb-3">근태 조정 — {row.workerName}</h3>
            <div className="flex gap-0 border-b border-transparent -mb-[2px]">
              {(['adjust', 'history'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-extrabold border-b-2 transition-colors ${
                    tab === t
                      ? 'border-accent text-accent bg-white'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {t === 'adjust' ? '조정 / 반려' : `정정 이력${history ? ` (${history.entries.length}건)` : ''}`}
                </button>
              ))}
            </div>
          </header>

          {/* ── 조정/반려 탭 ── */}
          {tab === 'adjust' && (<>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">출근 시각</span>
                <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
              </label>
              <label className="block">
                <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">퇴근 시각</span>
                <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
              </label>
            </div>
            {/* 야간근무 익일 퇴근 옵션 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkOutNextDay}
                onChange={(e) => setCheckOutNextDay(e.target.checked)}
                className="w-4 h-4 rounded accent-accent"
              />
              <span className="text-sm font-bold text-ink">
                익일 퇴근
                <span className="ml-1.5 text-[0.6875rem] font-normal text-ink-muted">(야간근무 — 다음날 오전 퇴근인 경우)</span>
              </span>
              {checkOutNextDay && (
                <span className="ml-auto text-[0.6875rem] font-extrabold text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                  퇴근 기준일 +1일
                </span>
              )}
            </label>
            <label className="block">
              <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">근무 유형</span>
              <select value={workType} onChange={(e) => setWorkType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent">
                {WORK_TYPE_OPTIONS.map((wt) => (
                  <option key={wt} value={wt}>{WORK_TYPE_LABEL[wt]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">
                사유 <span className="text-danger">*</span> (조정/반려 모두 필수, 2자 이상)
              </span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="예: 출근 지문 인식 실패로 09:15 → 08:50 정정"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent resize-none" />
            </label>

            {shiftComplete && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="text-sm font-extrabold text-amber-800">야간 2교대 재출근 활성화</div>
                <div className="text-[0.6875rem] text-amber-700 leading-relaxed">
                  오전 교대 근무({isoToHm(row.checkInTime)}~{isoToHm(row.checkOutTime)})가 완료된 상태입니다.
                  같은 날 야간 교대 출근이 필요한 경우 아래 버튼을 클릭하면 근로자의 출근 등록이 다시 활성화됩니다.
                  오전 기록은 조정 이력에 보존됩니다.
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmNightReset(true)}
                  disabled={busy}
                  className="w-full py-2 rounded-md bg-amber-500 text-white text-sm font-extrabold hover:bg-amber-600 disabled:opacity-50"
                >
                  야간 재출근 활성화
                </button>
              </div>
            )}

            {/* 출근 초기화 — 잘못 등록된 출근 시각을 null 로 초기화, 근로자가 재등록 가능 */}
            {row.checkInTime && !shiftComplete && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="text-sm font-extrabold text-orange-800">출근 초기화</div>
                <div className="text-[0.6875rem] text-orange-700 leading-relaxed">
                  출근 시각({isoToHm(row.checkInTime)})이 잘못 등록된 경우 초기화하면 근로자가 다시 출근 등록할 수 있습니다.
                  기존 기록은 정정 이력에 보존됩니다.
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmCheckInReset(true)}
                  disabled={busy || !reasonValid}
                  className="w-full py-2 rounded-md bg-orange-500 text-white text-sm font-extrabold hover:bg-orange-600 disabled:opacity-50"
                >
                  출근 초기화
                </button>
                {!reasonValid && (
                  <p className="text-[0.6875rem] text-orange-600">* 위 사유란을 먼저 입력해 주세요 (2자 이상)</p>
                )}
              </div>
            )}

            {error && (
              <div role="alert" className="bg-red-50 border-2 border-red-300 rounded-md px-3 py-2 text-sm font-bold text-red-800">
                {error}
              </div>
            )}
          </div>

          <footer className="px-5 py-3 bg-surface-soft border-t border-line flex flex-wrap justify-between gap-2 sticky bottom-0">
            <button onClick={onClose}
              className="px-4 py-2 rounded-md border-2 border-line-strong text-sm font-bold hover:bg-surface">
              취소
            </button>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReject(true)} disabled={busy || !reasonValid}
                className="px-4 py-2 rounded-md border-2 border-danger text-danger text-sm font-extrabold hover:bg-danger hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                반려
              </button>
              <button onClick={saveAdjust} disabled={busy || !reasonValid}
                className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? '저장 중…' : '조정 저장'}
              </button>
            </div>
          </footer>
          </>)}

          {/* ── 정정 이력 탭 ── */}
          {tab === 'history' && (
            <div className="p-5">
              {historyLoading && (
                <div className="text-center py-8 text-sm text-ink-muted font-bold">이력 불러오는 중…</div>
              )}
              {!historyLoading && history && (
                <>
                  {/* 체인 무결성 */}
                  <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-extrabold ${
                    history.chainOk
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                      : 'bg-red-50 border border-red-300 text-red-800'
                  }`}>
                    {history.chainOk ? '✓ SHA-256 체인 무결성 검증 완료' : '⚠ 체인 무결성 오류 — 감사 필요'}
                  </div>

                  {history.entries.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <div className="text-sm text-ink-muted">정정 이력이 없습니다.</div>
                      {row.status === 'APPROVED' && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5 inline-block">
                          ✓ 이 기록은 수정 없이 그대로 승인되었습니다.
                        </div>
                      )}
                      {row.status === 'ADJUSTED' && (
                        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 inline-block">
                          ⚠ 상태가 ADJUSTED이나 이력 레코드가 없습니다 — 마이그레이션 데이터 불일치
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.entries.map((e, i) => (
                        <HistoryCard key={e.id} entry={e} index={i + 1} />
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="mt-4 flex justify-end">
                <button onClick={onClose}
                  className="px-4 py-2 rounded-md border-2 border-line-strong text-sm font-bold hover:bg-surface">
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AccessibleConfirmDialog
        open={confirmReject}
        tone="destructive"
        title="이 근태 기록을 반려하시겠습니까?"
        message="반려 후 status 가 REJECTED 로 변경되며, 사유 + SHA-256 체인이 audit log 에 영구 기록됩니다."
        confirmLabel="반려"
        cancelLabel="취소"
        onConfirm={doReject}
        onCancel={() => setConfirmReject(false)}
      />
      <AccessibleConfirmDialog
        open={confirmNightReset}
        tone="neutral"
        title="야간 재출근을 활성화하시겠습니까?"
        message={`오전 기록(${isoToHm(row.checkInTime)}~${isoToHm(row.checkOutTime)})은 조정 이력에 보존되며, 출근 시각이 초기화됩니다. 근로자가 야간 출근 버튼을 다시 누를 수 있게 됩니다.`}
        confirmLabel="활성화"
        cancelLabel="취소"
        onConfirm={doNightReset}
        onCancel={() => setConfirmNightReset(false)}
      />
      <AccessibleConfirmDialog
        open={confirmCheckInReset}
        tone="destructive"
        title="출근 시각을 초기화하시겠습니까?"
        message={`현재 출근 시각(${isoToHm(row.checkInTime)})이 null로 초기화됩니다. 기존 기록은 정정 이력에 보존되며, 근로자가 출근을 다시 등록할 수 있게 됩니다.`}
        confirmLabel="초기화"
        cancelLabel="취소"
        onConfirm={doCheckInReset}
        onCancel={() => setConfirmCheckInReset(false)}
      />
    </>
  );
}

function KpiCard({
  label, value, unit, tone = 'default', onClick,
}: {
  label: string; value: number; unit: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'early';
  onClick?: () => void;
}) {
  /* 사용자 요청 2026-04-28: 단색 → 그라데이션. 페이지 배경(slate-200)과 어울리게 from-{tone}-50 → white.
     텍스트는 {tone}-900 으로 AAA 대비(7:1+) 유지. onClick 있을 때 button + hover/focus 강조. */
  const colors: Record<string, string> = {
    default: 'bg-gradient-to-br from-slate-100 to-white border-slate-300 text-ink',
    accent:  'bg-gradient-to-br from-cyan-50 to-white border-cyan-300 text-cyan-900',
    success: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300 text-emerald-900',
    warning: 'bg-gradient-to-br from-amber-50 to-white border-amber-300 text-amber-900',
    early:   'bg-gradient-to-br from-orange-50 to-white border-orange-300 text-orange-900',
  };
  const baseCls = `px-4 py-3 rounded-lg border ${colors[tone]} shadow-card text-left`;
  const inner = (
    <>
      <div className="text-[0.8125rem] font-extrabold tracking-tight flex items-center gap-1">
        {label}
        {onClick && <span aria-hidden className="text-sm">›</span>}
      </div>
      <div className="font-black mt-1"><span className="text-3xl">{value}</span> <span className="text-sm font-bold">{unit}</span></div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseCls} hover:shadow-modal hover:border-current transition-shadow active:scale-[0.98]`}
        aria-label={`${label} ${value}${unit} — 자세히`}
      >
        {inner}
      </button>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}

/* ─────────────── (PendingApprovalModal 제거 — 결재관리 페이지(/approvals)로 통합) ─────────────── */

function _PendingApprovalModal_REMOVED({
  rows, dateStr, onClose, onAdjust, onRefresh,
}: {
  rows: Row[];
  dateStr: string;
  onClose: () => void;
  onAdjust: (r: Row) => void;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function approve(r: Row) {
    if (!r.recordId || busyId) return;
    setBusyId(r.recordId); setError(null);
    try {
      const res = await fetch(`/api/attendance/${r.recordId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${r.workerName} 승인 실패: ${data?.message ?? data?.error ?? ''}`);
        return;
      }
      onRefresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusyId(null);
    }
  }

  async function doReject() {
    const r = confirmReject;
    setConfirmReject(null);
    if (!r || !r.recordId) return;
    const reason = rejectReason.trim();
    if (reason.length < 2) {
      setError('반려 사유를 2자 이상 입력하세요.');
      return;
    }
    setBusyId(r.recordId); setError(null);
    try {
      const res = await fetch(`/api/attendance/${r.recordId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${r.workerName} 반려 실패: ${data?.message ?? data?.error ?? ''}`);
        return;
      }
      setRejectReason('');
      onRefresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onClose}>
        <div className="w-full max-w-[760px] bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-ink">결재 대기 — {dateStr}</h3>
              <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">
                COMPANY/MANAGER: 승인 / 반려 / 조정 가능. 모든 결재는 audit_log 영구 기록.
              </div>
            </div>
            <button onClick={onClose} aria-label="닫기"
              className="px-3 py-1.5 rounded-md text-sm font-bold border-2 border-line-strong hover:bg-surface-soft">
              닫기
            </button>
          </header>

          {error && (
            <div role="alert" className="mx-5 mt-3 bg-red-50 border-2 border-red-300 rounded-md px-3 py-2 text-sm font-bold text-red-800">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-ink-muted">
                결재 대기 항목이 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-ink-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">직원</th>
                    <th className="px-3 py-2 text-left">출근</th>
                    <th className="px-3 py-2 text-left">퇴근</th>
                    <th className="px-3 py-2 text-left">유형</th>
                    <th className="px-3 py-2 text-right">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.workerId}>
                      <td className="px-3 py-2 font-extrabold text-ink">{r.workerName}</td>
                      <td className="px-3 py-2 font-mono font-extrabold">
                        {r.checkInTime ? <span className="text-emerald-700">{fmtTime(r.checkInTime)}</span> : <span className="text-amber-600">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono font-extrabold">
                        {r.checkOutTime ? <span className="text-accent">{fmtTime(r.checkOutTime)}</span> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold">{r.workType ? WORK_TYPE_LABEL[r.workType] ?? r.workType : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <button onClick={() => approve(r)} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-sm font-extrabold border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-colors">
                            {busyId === r.recordId ? '…' : '승인'}
                          </button>
                          <button onClick={() => { setRejectReason(''); setConfirmReject(r); }} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-sm font-extrabold border-2 border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50 transition-colors">
                            반려
                          </button>
                          <button onClick={() => onAdjust(r)} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-sm font-extrabold border-2 border-accent text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors">
                            조정
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 반려 확인 + 사유 입력 보조 다이얼로그 */}
      {confirmReject && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4" onClick={() => setConfirmReject(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-modal p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold text-ink-mid">{confirmReject.workerName} 반려</h2>
            <p className="text-base font-medium text-ink-mid">사유는 audit_log 에 영구 기록됩니다 (2자 이상).</p>
            <textarea rows={3} autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 출근지문 미인식 / 위치 이탈 등"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent resize-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmReject(null)}
                className="min-h-11 px-5 py-3 rounded-lg bg-white text-ink-mid border-2 border-line-strong text-base font-bold hover:bg-surface-soft">
                취소
              </button>
              <button onClick={doReject} disabled={rejectReason.trim().length < 2}
                className="min-h-11 px-5 py-3 rounded-lg bg-accent text-white text-base font-extrabold hover:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed">
                반려
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────── 관리자 본인 출퇴근 위젯 ─────────────── */

function AdminPunchWidget({ selfRecord, onSuccess }: { selfRecord: SelfRecord; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fmtTime(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const punchAction = useCallback(async (endpoint: string) => {
    setBusy(true); setError(null);
    try {
      let body: Record<string, number> = {};
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { body = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(); },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? '처리 실패');
      else onSuccess();
    } catch { setError('네트워크 오류'); }
    finally { setBusy(false); }
  }, [onSuccess]);

  const checkInTime = fmtTime(selfRecord?.checkInTime ?? null);
  const checkOutTime = fmtTime(selfRecord?.checkOutTime ?? null);

  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 shadow-card flex flex-wrap items-center gap-3">
      <div className="text-sm font-extrabold text-ink shrink-0">관리자 본인 출퇴근</div>
      <div className="flex items-center gap-2 text-sm font-mono font-bold">
        <span className="text-ink-faint">출근</span>
        <span className={checkInTime ? 'text-emerald-700' : 'text-amber-600'}>{checkInTime ?? '—'}</span>
        <span className="text-ink-faint mx-1">·</span>
        <span className="text-ink-faint">퇴근</span>
        <span className={checkOutTime ? 'text-accent' : 'text-ink-faint'}>{checkOutTime ?? '—'}</span>
      </div>
      <div className="flex gap-2 ml-auto">
        {!selfRecord?.checkInTime && (
          <button onClick={() => punchAction('/api/attendance/check-in')} disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition">
            {busy ? '처리 중…' : '출근'}
          </button>
        )}
        {selfRecord?.checkInTime && !selfRecord?.checkOutTime && (
          <button onClick={() => punchAction('/api/attendance/check-out')} disabled={busy}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50 active:scale-95 transition">
            {busy ? '처리 중…' : '퇴근'}
          </button>
        )}
        {selfRecord?.checkInTime && selfRecord?.checkOutTime && (
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-ink-faint text-sm font-extrabold border border-slate-300">퇴근 완료</span>
        )}
      </div>
      {error && <div className="w-full text-sm font-bold text-red-700">{error}</div>}
    </div>
  );
}

/* ─────────────── 정정 이력 통합 조회 탭 ─────────────── */

const ADJ_TYPE_LABEL: Record<string, string> = {
  CORRECTION: '정정', ADDITION: '추가', DELETION: '삭제', LEAVE: '휴가처리',
};

type AdjRow = {
  id: string; recordId: string; workDate: string;
  workerName: string; employeeNo: string | null;
  adjustmentType: string; reason: string;
  original: { checkIn: string | null; checkOut: string | null; workType: string | null };
  adjusted: { checkIn: string | null; checkOut: string | null; workType: string | null };
  adjustedByName: string | null;
  createdAt: string;
};

function AdjustmentsTab({ defaultMonth }: { defaultMonth: string }) {
  const [startDate, setStartDate] = useState(`${defaultMonth}-01`);
  const [endDate, setEndDate] = useState(`${defaultMonth}-${new Date(parseInt(defaultMonth.slice(0,4)), parseInt(defaultMonth.slice(5,7)), 0).getDate().toString().padStart(2,'0')}`);
  const [rows, setRows] = useState<AdjRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fmtTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  async function load() {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/adjustments?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '조회 실패'); return; }
      setRows(data.adjustments ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="bg-surface border border-line rounded-lg px-4 py-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] font-extrabold text-ink-muted">시작일</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold bg-white" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] font-extrabold text-ink-muted">종료일</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold bg-white" />
        </label>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        {total !== null && total > 0 && (
          <a
            href={`/api/attendance/adjustments/export?startDate=${startDate}&endDate=${endDate}`}
            download
            className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 flex items-center gap-1.5"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            엑셀
          </a>
        )}
        {total !== null && (
          <span className="text-sm font-bold text-ink-muted ml-auto">총 {total}건</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 테이블 */}
      {rows.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">근로자</th>
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-left">유형</th>
                  <th className="px-3 py-2 text-left">출근 전→후</th>
                  <th className="px-3 py-2 text-left">퇴근 전→후</th>
                  <th className="px-3 py-2 text-left">사유</th>
                  <th className="px-3 py-2 text-left">정정자</th>
                  <th className="px-3 py-2 text-left">정정일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-extrabold text-ink">
                      {r.workerName}
                      {r.employeeNo && <span className="ml-1 text-[0.6875rem] text-ink-muted font-mono">({r.employeeNo})</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">{r.workDate}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-extrabold border ${
                        r.adjustmentType === 'CORRECTION' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                        r.adjustmentType === 'ADDITION'   ? 'bg-green-50 text-green-800 border-green-300' :
                        r.adjustmentType === 'DELETION'   ? 'bg-red-50 text-red-800 border-red-300' :
                        'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {ADJ_TYPE_LABEL[r.adjustmentType] ?? r.adjustmentType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">
                      <span className="text-ink-muted">{fmtTime(r.original.checkIn)}</span>
                      <span className="mx-1 text-ink-faint">→</span>
                      <span className="font-extrabold text-emerald-700">{fmtTime(r.adjusted.checkIn)}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">
                      <span className="text-ink-muted">{fmtTime(r.original.checkOut)}</span>
                      <span className="mx-1 text-ink-faint">→</span>
                      <span className="font-extrabold text-accent">{fmtTime(r.adjusted.checkOut)}</span>
                    </td>
                    <td className="px-3 py-2 text-sm max-w-[180px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-3 py-2 text-sm text-ink-muted">{r.adjustedByName ?? '—'}</td>
                    <td className="px-3 py-2 text-[0.6875rem] font-mono text-ink-muted whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && total === 0 && (
        <div className="text-center py-10 text-sm text-ink-faint">해당 기간에 정정 이력이 없습니다.</div>
      )}

      {total === null && !loading && (
        <div className="text-center py-10 text-sm text-ink-muted">기간을 선택하고 조회 버튼을 눌러주세요.</div>
      )}
    </div>
  );
}
