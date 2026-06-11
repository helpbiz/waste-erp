'use client';

import { useState } from 'react';

const DATA_TYPES = [
  { value: 'vehicleLog',    label: '차량일지',    dateLabel: '일지 날짜(logDate) 기준',   warn: '승인된 기록 포함 삭제됩니다.' },
  { value: 'complaint',     label: '민원일지',    dateLabel: '등록일(createdAt) 기준',    warn: '처리 중인 민원도 포함됩니다.' },
  { value: 'attendance',    label: '출퇴근 기록', dateLabel: '근무일(workDate) 기준',     warn: '미마감 기록도 포함됩니다.' },
  { value: 'leaveRequest',  label: '휴가 신청',   dateLabel: '신청일(createdAt) 기준',   warn: '승인된 신청도 포함됩니다.' },
  { value: 'tbmSession',    label: 'TBM 기록',    dateLabel: '교육일(sessionDate) 기준', warn: '서명 기록도 함께 삭제됩니다.' },
  { value: 'safetyReport',  label: '안전보고서',  dateLabel: '보고일(reportDate) 기준',  warn: '검토 완료된 보고서도 포함됩니다.' },
] as const;

type DataTypeValue = typeof DATA_TYPES[number]['value'];

export default function DataCleanupClient() {
  const [type, setType] = useState<DataTypeValue>('vehicleLog');
  const [cutoffDate, setCutoffDate] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ count: number; date: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = DATA_TYPES.find((d) => d.value === type)!;
  const canDelete = confirm === '삭제확인' && cutoffDate && previewCount !== null && previewCount > 0 && !busy;

  async function handlePreview() {
    if (!cutoffDate) { setError('기준일을 선택하세요.'); return; }
    setBusy(true); setError(null); setPreviewCount(null);
    try {
      const res = await fetch('/api/admin/data-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, cutoffDate, dryRun: true }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? '조회 실패'); return; }
      setPreviewCount(d.count);
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!canDelete) return;
    if (!confirm_hard()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/data-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, cutoffDate, dryRun: false }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? '삭제 실패'); return; }
      setResult({ count: d.count, date: cutoffDate, label: selected.label });
      setPreviewCount(null);
      setConfirm('');
      setCutoffDate('');
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  function confirm_hard() {
    return window.confirm(
      `⚠ 최종 확인\n\n` +
      `[ ${selected.label} ] ${cutoffDate} 이전 데이터 ${previewCount}건을 영구 삭제합니다.\n\n` +
      `이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink">데이터 일괄 삭제</h2>
        <p className="text-sm font-bold text-ink-muted mt-1">
          항목별로 일자 기준 이전 데이터를 일괄 삭제합니다. 사용자·차량 등록 데이터는 삭제 대상에서 제외됩니다.
        </p>
      </div>

      {/* 경고 배너 */}
      <div className="bg-red-50 border-2 border-red-400 rounded-xl px-5 py-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">⚠</span>
        <div>
          <div className="font-extrabold text-red-900 text-sm">삭제된 데이터는 복구 불가능합니다</div>
          <div className="text-sm font-bold text-red-700 mt-1 leading-relaxed">
            반드시 삭제 전 데이터 백업을 권장합니다.<br />
            모든 삭제 작업은 감사 로그에 영구 기록됩니다.
          </div>
        </div>
      </div>

      {/* 항목 선택 */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-[0.6875rem] font-extrabold text-ink tracking-wide">삭제 항목 선택</label>
          <div className="grid grid-cols-2 gap-2">
            {DATA_TYPES.map((dt) => (
              <button
                key={dt.value}
                type="button"
                onClick={() => { setType(dt.value); setPreviewCount(null); setConfirm(''); setResult(null); }}
                className={`px-3 py-2.5 rounded-lg border-2 text-sm font-extrabold text-left transition ${
                  type === dt.value ? 'bg-accent text-white border-accent' : 'bg-surface text-ink border-line hover:border-accent'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 기준일 + 설명 */}
        <div className="space-y-2">
          <label className="block text-[0.6875rem] font-extrabold text-ink tracking-wide">
            기준일 <span className="font-bold text-ink-muted">— {selected.dateLabel} 이전 데이터 모두 삭제</span>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => { setCutoffDate(e.target.value); setPreviewCount(null); setConfirm(''); }}
              className="flex-1 px-3 py-2 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
            />
            <button
              onClick={handlePreview}
              disabled={busy || !cutoffDate}
              className="px-4 py-2 rounded-lg bg-slate-100 border border-line text-sm font-extrabold hover:bg-slate-200 disabled:opacity-50"
            >
              {busy ? '조회 중…' : '건수 조회'}
            </button>
          </div>
          <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ {selected.warn}
          </p>
        </div>

        {/* 건수 미리보기 */}
        {previewCount !== null && (
          <div className={`rounded-xl px-4 py-3 border-2 ${
            previewCount === 0 ? 'bg-slate-50 border-slate-200 text-ink-faint' : 'bg-red-50 border-red-300 text-red-900'
          }`}>
            <div className="text-sm font-extrabold">
              {previewCount === 0
                ? `${cutoffDate} 이전 ${selected.label} 데이터가 없습니다.`
                : `삭제 예정: ${selected.label} ${previewCount.toLocaleString()}건 (${cutoffDate} 이전)`
              }
            </div>
          </div>
        )}

        {/* 삭제 확인 입력 */}
        {previewCount !== null && previewCount > 0 && (
          <div className="space-y-2">
            <label className="block text-[0.6875rem] font-extrabold text-ink tracking-wide">
              삭제를 진행하려면 아래 칸에 <code className="bg-slate-100 px-1 rounded font-mono text-red-700">삭제확인</code> 을 입력하세요
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="삭제확인"
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-danger"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
        )}

        <button
          onClick={handleDelete}
          disabled={!canDelete}
          className="w-full py-3 rounded-xl bg-danger text-white text-sm font-extrabold hover:bg-red-700 disabled:opacity-40 transition"
        >
          {busy ? '삭제 중…' : `🗑 ${selected.label} ${previewCount ?? '—'}건 영구 삭제`}
        </button>
      </div>

      {/* 삭제 결과 */}
      {result && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl px-5 py-4">
          <div className="font-extrabold text-green-900">삭제 완료</div>
          <div className="text-sm font-bold text-green-800 mt-1">
            [{result.label}] {result.date} 이전 데이터 {result.count.toLocaleString()}건 삭제되었습니다.
          </div>
        </div>
      )}

      {/* 사용 안내 */}
      <div className="bg-slate-50 border border-line rounded-xl px-5 py-4 space-y-2">
        <div className="text-sm font-extrabold text-ink">사용 예시</div>
        <ul className="text-sm font-bold text-ink-muted space-y-1 list-disc list-inside">
          <li>차량일지 5/24까지 삭제 → 차량일지 선택 + 기준일 2026-05-24 입력</li>
          <li>민원일지 5/10까지 삭제 → 민원일지 선택 + 기준일 2026-05-10 입력</li>
          <li>삭제 제외 항목: 사용자 등록, 차량 등록, 부서/직책/직급 설정</li>
        </ul>
      </div>
    </div>
  );
}
