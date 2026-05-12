'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibleConfirmDialog from '@/components/ui/AccessibleConfirmDialog';

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
  const [editing, setEditing] = useState<Row | null>(null);

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
      <div>
        <h2 className="text-xl font-extrabold text-ink">근태관리</h2>
        <div className="flex items-center gap-2 mt-2">
          <input type="date" value={selectedDate} onChange={(e) => changeDate(e.target.value)}
            aria-label="기준일"
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold w-[200px]" />
          <button onClick={() => changeDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1.5 rounded border border-line bg-white text-xs font-bold hover:bg-slate-50 shrink-0">오늘</button>
        </div>
      </div>

      {/* 6 KPI — 결재 대기 클릭 시 승인/반려/조정 모달 (canManage 시만 활성) */}
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
          <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase tracking-wider">
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
              <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-10 text-center text-slate-500">근로자가 없습니다.</td></tr>
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
                  {r.checkOutTime ? <span className="text-accent">{fmtTime(r.checkOutTime)}</span> : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-3 py-2">
                  {r.status ? (
                    <span className={`text-[0.6875rem] font-extrabold px-2 py-0.5 rounded border-2 ${
                      r.status === 'APPROVED' ? 'bg-emerald-200 text-emerald-900 border-emerald-600' :
                      r.status === 'REJECTED' ? 'bg-red-200 text-red-900 border-red-500' :
                      r.status === 'ADJUSTED' ? 'bg-blue-200 text-blue-900 border-blue-500' :
                      'bg-amber-200 text-amber-900 border-amber-500'
                    }`}>{STATUS_LABEL[r.status]}</span>
                  ) : <span className="text-[0.625rem] font-mono text-slate-500">미기록</span>}
                </td>
                {canManage && (
                  <td className="px-3 py-2">
                    {r.recordId ? (
                      <button
                        onClick={() => setEditing(r)}
                        className="px-3 py-1.5 rounded-md text-xs font-extrabold border-2 border-accent text-accent hover:bg-accent hover:text-white transition active:scale-95"
                      >
                        조정/반려
                      </button>
                    ) : (
                      <span className="text-[0.625rem] font-mono text-slate-400">출근 전</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 조정/반려 모달 (사용자 요청 2026-04-28). */}
      {editing && editing.recordId && (
        <AdjustModal
          row={editing}
          dateStr={selectedDate}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); router.refresh(); }}
        />
      )}

    </div>
  );
}

/* ─────────────── 조정/반려 모달 ─────────────── */

function AdjustModal({
  row, dateStr, onClose, onSuccess,
}: {
  row: Row;
  dateStr: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  /* HH:MM 추출 */
  function isoToHm(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  /* HH:MM + dateStr → ISO datetime (KST → 서버 정규화). 빈 값은 null. */
  function hmToIso(hm: string): string | null {
    if (!hm) return null;
    const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const local = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    return local.toISOString();
  }

  const [checkIn, setCheckIn] = useState(isoToHm(row.checkInTime));
  const [checkOut, setCheckOut] = useState(isoToHm(row.checkOutTime));
  const [workType, setWorkType] = useState<string>(row.workType ?? 'NORMAL');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

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
          adjustedCheckOut: hmToIso(checkOut),
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
          <header className="px-5 py-4 bg-surface-soft border-b-2 border-line">
            <h3 className="text-base font-extrabold text-ink">근태 조정/반려 — {row.workerName}</h3>
            <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">
              기준일 {dateStr} · 사유 + 출퇴근 시각 변경 시 attendance_adjustments(SHA-256) + audit_log 기록
            </div>
          </header>

          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">출근 시각</span>
                <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
              </label>
              <label className="block">
                <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">퇴근 시각</span>
                <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
              </label>
            </div>
            <label className="block">
              <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">근무 유형</span>
              <select value={workType} onChange={(e) => setWorkType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
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
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
            </label>

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
        {onClick && <span aria-hidden className="text-xs">›</span>}
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
                <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase tracking-wider">
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
                        {r.checkOutTime ? <span className="text-accent">{fmtTime(r.checkOutTime)}</span> : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold">{r.workType ? WORK_TYPE_LABEL[r.workType] ?? r.workType : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <button onClick={() => approve(r)} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-xs font-extrabold border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-colors">
                            {busyId === r.recordId ? '…' : '승인'}
                          </button>
                          <button onClick={() => { setRejectReason(''); setConfirmReject(r); }} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-xs font-extrabold border-2 border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50 transition-colors">
                            반려
                          </button>
                          <button onClick={() => onAdjust(r)} disabled={busyId === r.recordId}
                            className="px-2.5 py-1 rounded text-xs font-extrabold border-2 border-accent text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors">
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
              className="w-full px-3 py-2 rounded-md border-2 border-line text-base font-semibold focus:outline-none focus:border-accent resize-none" />
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
