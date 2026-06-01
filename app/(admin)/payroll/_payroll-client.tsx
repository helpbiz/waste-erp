'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PayslipTab from './_payslip-tab';
import PolicyTab from './_policy-tab';
import type { PayrollPolicyData } from '@/lib/payroll-policy';

export type ApproverInfo = {
  approverId:           string | null;
  approverName:         string | null;
  isCurrentUserApprover: boolean;
};

export type Row = {
  workerId: string;
  workerName: string;
  totalWorkDays: number;
  totalWorkHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  absenceDays: number;
  isFinalized: boolean;
  finalizedAt: string | null;
  finalizedByName: string | null;
};

export default function PayrollClient({
  ym,
  rows,
  finalizedCount,
  isManager,
  canUnlock,
  policy,
  approverInfo,
}: {
  ym: string;
  rows: Row[];
  finalizedCount: number;
  isManager: boolean;
  canUnlock: boolean;
  policy: PayrollPolicyData;
  approverInfo: ApproverInfo;
}) {
  const router = useRouter();
  const [tab, setTab]   = useState<'finalize' | 'payslip' | 'policy'>('finalize');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.work += r.totalWorkHours;
        acc.over += r.overtimeHours;
        acc.night += r.nightHours;
        acc.holiday += r.holidayHours;
        acc.absent += r.absenceDays;
        return acc;
      },
      { work: 0, over: 0, night: 0, holiday: 0, absent: 0 }
    );
  }, [rows]);

  const allFinalized = finalizedCount === rows.length && rows.length > 0;
  const noneFinalized = finalizedCount === 0;
  const partial = finalizedCount > 0 && finalizedCount < rows.length;

  function navigateMonth(delta: number) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    router.push(`/payroll?ym=${next}`);
  }

  async function finalize(workerIds?: string[]) {
    if (!confirm(workerIds ? '선택한 근로자만 마감하시겠습니까?' : `${ym} 전체 근로자 ${rows.length}명을 마감하시겠습니까?\n마감 후 근태 조정 시 이중승인이 필요합니다.`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/attendance/finalize-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearMonth: ym, workerIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'already_finalized') {
          setError(`이미 마감된 근로자가 있습니다 (${data.finalizedWorkerIds.length}명). 해제 후 재시도하세요.`);
        } else {
          setError(data?.error ?? '마감 실패');
        }
        return;
      }
      setInfo(`✓ ${data.workerCount}명 마감 완료 (${ym})`);
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function doUnlock(workerIds?: string[]) {
    const target = workerIds ? '선택한 근로자의' : `${ym} 전체`;
    const reason = prompt(`${target} 마감을 해제합니다.\n해제 사유를 입력하세요 (10자 이상, 영구 보존):`);
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) setError('사유는 10자 이상이어야 합니다.');
      return;
    }
    if (!confirm(`${target} 마감을 해제하시겠습니까?\n해제 후 수정하고 재마감하세요.`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const body: Record<string, unknown> = { yearMonth: ym, reason: reason.trim() };
      if (workerIds) body.workerIds = workerIds;
      const res = await fetch('/api/attendance/finalize-month/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '해제 실패');
        return;
      }
      setInfo(`✓ ${data.unlockedCount}건 해제됨 — 수정 후 재마감 하세요.`);
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function unlock() { await doUnlock(); }
  async function unlockOne(workerId: string, workerName: string) {
    setInfo(`${workerName} 개별 해제 진행 중…`);
    await doUnlock([workerId]);
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* 헤더 + 월 네비 */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">인건비 정산</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">월마감 · 급여명세 발송</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateMonth(-1)} className="px-3 py-2 rounded-md border border-line text-ink hover:bg-surface-soft text-sm font-extrabold">←</button>
          <div className="px-4 py-2 rounded-md bg-surface border-2 border-line font-mono font-extrabold text-ink">{ym}</div>
          <button onClick={() => navigateMonth(1)} className="px-3 py-2 rounded-md border border-line text-ink hover:bg-surface-soft text-sm font-extrabold">→</button>
        </div>
      </header>

      {/* 탭 전환 */}
      <div className="grid grid-cols-3 gap-1 bg-surface-soft rounded-lg p-1 border border-line max-w-sm">
        {([['finalize', '📋 근태 마감'], ['payslip', '💰 급여명세'], ['policy', '⚙️ 급여 정책']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`py-2 rounded-md text-sm font-extrabold transition ${tab === k ? 'bg-accent text-white shadow-card' : 'text-ink-muted hover:bg-surface'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'payslip' && <PayslipTab ym={ym} approverInfo={approverInfo} />}
      {tab === 'policy'  && <PolicyTab initialPolicy={policy} />}
      {tab === 'finalize' && (<>
      {/* 요약 + 액션 */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
          <Stat label="근로자" value={`${rows.length}명`} />
          <Stat label="총 근무시간" value={`${totals.work.toFixed(1)}h`} tone="text-accent" />
          <Stat label="연장" value={`${totals.over.toFixed(1)}h`} tone="text-warn" />
          <Stat label="야간" value={`${totals.night.toFixed(1)}h`} tone="text-info" />
          <Stat label="휴일" value={`${totals.holiday.toFixed(1)}h`} tone="text-info" />
          <Stat label="결근일" value={`${totals.absent}일`} tone="text-danger" />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
          {allFinalized ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-green-100 text-success border border-green-200">
              🔒 전체 마감 완료
            </span>
          ) : noneFinalized ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-amber-100 text-warn border border-amber-200">
              미마감 ({rows.length}명)
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-blue-100 text-info border border-blue-200">
              부분 마감 ({finalizedCount}/{rows.length})
            </span>
          )}

          {isManager && !allFinalized && (
            <button
              onClick={() => finalize()}
              disabled={busy}
              className="ml-auto px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 disabled:opacity-50"
            >
              {busy ? '처리 중…' : `${ym} 전체 마감`}
            </button>
          )}
          {canUnlock && finalizedCount > 0 && (
            <button
              onClick={unlock}
              disabled={busy}
              className="px-4 py-2 rounded-md border-2 border-danger text-danger text-sm font-extrabold hover:bg-danger hover:text-white active:scale-95 disabled:opacity-50"
            >
              {ym} 전체 마감 해제
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>
        )}
        {info && (
          <div className="mt-3 bg-green-50 border border-green-300 rounded-md px-3 py-2 text-xs font-bold text-success">{info}</div>
        )}
      </section>

      {/* 표 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[0.8125rem]">
          <thead>
            <tr>
              {['근로자', '근무일', '총시간', '연장', '야간', '휴일', '결근', '잠금', '액션'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink bg-surface-soft border-b-2 border-line-strong font-mono whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-muted font-bold">
                  근로자가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.workerId} className={`${i % 2 === 1 ? 'bg-surface-soft' : ''}`}>
                <td className="px-3 py-2.5 border-b border-line text-ink font-bold">{r.workerName}</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-extrabold text-ink">{r.totalWorkDays}일</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-extrabold text-accent">{r.totalWorkHours.toFixed(1)}h</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-extrabold text-warn">{r.overtimeHours.toFixed(1)}h</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-info">{r.nightHours.toFixed(1)}h</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-info">{r.holidayHours.toFixed(1)}h</td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-extrabold text-danger">{r.absenceDays}일</td>
                <td className="px-3 py-2.5 border-b border-line">
                  {r.isFinalized ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold bg-green-100 text-success border border-green-200" title={`${r.finalizedAt} by ${r.finalizedByName}`}>
                      🔒 마감
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold bg-amber-100 text-warn border border-amber-200">
                      미마감
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 border-b border-line">
                  <div className="flex items-center gap-2">
                    {isManager && !r.isFinalized && (
                      <button
                        onClick={() => finalize([r.workerId])}
                        disabled={busy}
                        className="text-xs font-extrabold text-accent hover:underline disabled:opacity-50"
                      >
                        개별 마감
                      </button>
                    )}
                    {canUnlock && r.isFinalized && (
                      <button
                        onClick={() => unlockOne(r.workerId, r.workerName)}
                        disabled={busy}
                        className="text-xs font-extrabold text-danger hover:underline disabled:opacity-50"
                      >
                        해제
                      </button>
                    )}
                    {r.isFinalized && r.finalizedByName && (
                      <span className="text-[0.6875rem] font-mono font-bold text-ink-faint">
                        by {r.finalizedByName}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {partial && (
        <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
          <strong className="font-extrabold">부분 마감 상태</strong> · 일부 근로자만 마감되어 있습니다. 정산 일관성을 위해 가능한 한 모두 함께 마감해 주세요.
        </div>
      )}

      <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-info rounded-md px-4 py-3 text-xs text-info font-semibold leading-relaxed">
        <strong className="font-extrabold">가산임금 자동 계산 활성</strong> · 출퇴근 시각 기반으로 야간근로를 자동 집계합니다. 연장/야간/휴일 기준시간은 <button className="underline font-extrabold" onClick={() => setTab('policy')}>⚙️ 급여 정책</button> 탭에서 변경하세요.
      </div>
      </>)}
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-surface-alt border border-line rounded-lg px-3 py-2.5">
      <div className="text-[0.625rem] font-extrabold text-ink-muted tracking-widest uppercase">{label}</div>
      <div className={`mt-1 text-lg font-black font-mono tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}
