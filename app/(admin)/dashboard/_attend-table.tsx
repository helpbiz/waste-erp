'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AttendanceCard } from '@/lib/attendance';

type Row = {
  id: string;            // 실 record id 또는 'noatt-{workerId}'
  workerName: string;
  zoneName: string | null;
  time: string;
  timeColor: string;
  type: string;
  status: 'active' | 'pending' | 'alert' | 'info';
  statusLabel: string;
  action: string;
  actionColor: string;
  workType: string;
  checkInISO: string | null;
  checkOutISO: string | null;
};

export default function AttendTable({ readOnly, cards }: { readOnly: boolean; cards: AttendanceCard[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...cards].sort((a, b) => {
    const score = (c: AttendanceCard) =>
      (!c.checkInTime ? 0 : c.isLate ? 1 : c.status === 'PENDING' || c.status === 'ADJUSTED' ? 2 : 3);
    return score(a) - score(b);
  });
  const rows: Row[] = sorted.slice(0, 5).map(classify);

  const target = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="근태 목록 표">
      <table className="w-full min-w-[640px] text-[0.8125rem]">
        <thead>
          <tr>
            {['사원명', '구역', '출근시각', '근무유형', '상태', '조치'].map((h) => (
              <th key={h} className="text-left px-2.5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-ink bg-surface-soft border-b-2 border-line-strong font-mono">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-2.5 py-6 text-center text-ink-muted font-semibold">가시 범위에 해당하는 근로자가 없습니다.</td></tr>
          )}
          {rows.map((r, i) => {
            const synthetic = r.id.startsWith('noatt-');
            const clickable = !readOnly && !synthetic && r.action !== '-';
            return (
              <tr key={r.id} className={`${i % 2 === 1 ? 'bg-surface-soft' : ''} hover:bg-sky-100`}>
                <td className="px-2.5 py-2.5 border-b border-line text-ink font-bold">{r.workerName}</td>
                <td className="px-2.5 py-2.5 border-b border-line text-ink font-semibold">{r.zoneName ?? '—'}</td>
                <td className={`px-2.5 py-2.5 border-b border-line font-mono font-bold ${r.timeColor || 'text-ink'}`}>{r.time}</td>
                <td className="px-2.5 py-2.5 border-b border-line text-ink font-semibold">{r.type}</td>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <StatusChip kind={r.status}>{r.statusLabel}</StatusChip>
                </td>
                <td
                  className={`px-2.5 py-2.5 border-b border-line text-sm font-extrabold ${r.actionColor} ${
                    clickable ? 'cursor-pointer hover:underline' : 'cursor-default'
                  } ${readOnly && r.action !== '-' ? 'opacity-50 line-through pointer-events-none' : ''} ${synthetic && !readOnly ? 'opacity-60' : ''}`}
                  onClick={() => clickable && setOpenId(r.id)}
                  title={synthetic ? '결근 등록은 별도 화면 (Phase 1A-3)' : ''}
                >
                  {r.action}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {target && (
        <AdjustModal
          row={target}
          onClose={() => setOpenId(null)}
          onSaved={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function classify(c: AttendanceCard): Row {
  const fmtHm = (iso: string) => {
    const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
    return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
  };

  if (!c.checkInTime) {
    return {
      id: c.id, workerName: c.workerName, zoneName: c.zoneName,
      time: '미출근', timeColor: 'text-danger font-extrabold',
      type: '결근', status: 'alert', statusLabel: '미처리',
      action: '확인', actionColor: 'text-danger underline',
      workType: c.workType, checkInISO: c.checkInTime, checkOutISO: c.checkOutTime,
    };
  }
  if (c.isLate) {
    return {
      id: c.id, workerName: c.workerName, zoneName: c.zoneName,
      time: fmtHm(c.checkInTime), timeColor: 'text-warn',
      type: '지각', status: 'pending', statusLabel: '대기',
      action: '조정', actionColor: 'text-accent underline',
      workType: c.workType, checkInISO: c.checkInTime, checkOutISO: c.checkOutTime,
    };
  }
  if (c.workType === 'EARLY') {
    return {
      id: c.id, workerName: c.workerName, zoneName: c.zoneName,
      time: fmtHm(c.checkInTime), timeColor: 'text-info',
      type: '조기출근', status: 'info', statusLabel: '조정중',
      action: '조정', actionColor: 'text-accent underline',
      workType: c.workType, checkInISO: c.checkInTime, checkOutISO: c.checkOutTime,
    };
  }
  return {
    id: c.id, workerName: c.workerName, zoneName: c.zoneName,
    time: fmtHm(c.checkInTime), timeColor: '',
    type: '정상', status: 'active', statusLabel: '승인',
    action: '-', actionColor: 'text-ink-faint',
    workType: c.workType, checkInISO: c.checkInTime, checkOutISO: c.checkOutTime,
  };
}

function StatusChip({ kind, children }: { kind: 'active' | 'pending' | 'alert' | 'info'; children: React.ReactNode }) {
  const map = {
    active:  'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    alert:   'bg-red-100 text-red-700 border-red-200',
    info:    'bg-blue-100 text-blue-700 border-blue-200',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[kind]}`}>
      {children}
    </span>
  );
}

/* ─────────────── 조정 모달 ─────────────── */

function AdjustModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const initialIn = isoToLocalKstInput(row.checkInISO);
  const initialOut = isoToLocalKstInput(row.checkOutISO);
  const [checkIn, setCheckIn] = useState(initialIn);
  const [checkOut, setCheckOut] = useState(initialOut);
  const [workType, setWorkType] = useState(row.workType);
  const [adjustmentType, setAdjustmentType] = useState<'CORRECTION' | 'ADDITION' | 'DELETION' | 'LEAVE'>('CORRECTION');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (reason.trim().length < 2) {
      setError('사유를 2자 이상 입력해 주세요 (Plan §3-2 사유 필수).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        adjustedCheckIn: checkIn ? localKstInputToIso(checkIn) : null,
        adjustedCheckOut: checkOut ? localKstInputToIso(checkOut) : null,
        adjustedWorkType: workType,
        reason: reason.trim(),
        adjustmentType,
      };
      const res = await fetch(`/api/attendance/${row.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(translate(data?.error) ?? data?.message ?? '저장 실패');
        return;
      }
      onSaved();
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-surface rounded-xl shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-accent">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-ink">근태 조정 — {row.workerName}</h3>
            <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">레코드 #{row.id} · 변경 이력은 영구 보존됩니다 (SHA-256 체인)</div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-2xl font-bold leading-none px-2">&times;</button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* 원본 표시 */}
          <div className="bg-surface-alt rounded-md border border-line px-3 py-2.5 text-sm">
            <div className="font-extrabold text-ink mb-1">원본 값</div>
            <div className="font-mono font-bold text-ink-muted">
              출근 {row.checkInISO ? hm(row.checkInISO) : '—'} · 퇴근 {row.checkOutISO ? hm(row.checkOutISO) : '—'} · {row.workType}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="조정 출근 시각 (KST)">
              <input
                type="datetime-local"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="조정 퇴근 시각 (KST)">
              <input
                type="datetime-local"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="근무 유형">
              <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="NORMAL">정상</option>
                <option value="EARLY">조기출근</option>
                <option value="EXTENDED">연장</option>
                <option value="NIGHT">야간</option>
                <option value="HOLIDAY">휴일</option>
                <option value="ON_DUTY">당직</option>
              </select>
            </Field>
            <Field label="조정 유형">
              <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as 'CORRECTION' | 'ADDITION' | 'DELETION' | 'LEAVE')} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="CORRECTION">정정 (시간/유형 수정)</option>
                <option value="ADDITION">추가 (대리등록·결근확인)</option>
                <option value="DELETION">삭제</option>
                <option value="LEAVE">휴가 처리</option>
              </select>
            </Field>
          </div>

          <Field label="조정 사유 (필수, 영구 보존)">
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="기기 오류 / 망각 / 외부 행사 등 구체적 사유"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
            />
          </Field>

          {error && <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

          <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-3 py-2.5 text-[0.6875rem] text-amber-900 font-semibold leading-relaxed">
            <strong className="font-extrabold">감사 추적 안내</strong> · 본 조정은 attendance_adjustments 테이블에 SHA-256 prev_hash 체인으로 영구 보존되며 삭제할 수 없습니다 (Plan §3-2-D, 노동청 감사 대비).
          </div>
        </div>

        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button onClick={save} disabled={busy || reason.trim().length < 2} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : '조정 저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합 (label className 보존)
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[0.625rem] font-extrabold text-ink-muted tracking-wider mb-1'} />;
}

function hm(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

function isoToLocalKstInput(iso: string | null): string {
  if (!iso) return '';
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

function localKstInputToIso(local: string): string {
  /* 'YYYY-MM-DDTHH:mm' (KST 가정) → UTC ISO */
  const [datePart, timePart] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh - 9, mm, 0); // KST → UTC
  return new Date(utcMs).toISOString();
}

function translate(code?: string): string | null {
  switch (code) {
    case 'forbidden': return '권한이 없습니다.';
    case 'forbidden_contractor': return '본인 위탁업체 데이터만 조정 가능합니다.';
    case 'month_finalized': return '월 마감 후 수정은 이중승인 필요 (Phase 1A-4)';
    case 'not_found': return '레코드를 찾을 수 없습니다.';
    case 'invalid_request': return '입력값이 올바르지 않습니다.';
    default: return null;
  }
}
