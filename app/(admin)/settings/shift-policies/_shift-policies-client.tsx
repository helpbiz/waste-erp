'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/Field';

export type ShiftPolicyRow = {
  id: string;
  departmentId: string | null;
  departmentName: string | null;
  workerId: string | null;
  workerName: string | null;
  shiftType: 'DAY' | 'NIGHT' | 'DAWN';
  name: string;
  checkInRecognizeFrom: string | null;
  checkInRecognizeUntil: string | null;
  checkOutRecognizeFrom: string | null;
  checkOutRecognizeUntil: string | null;
  checkOutNextDay: boolean;
  offDays: number[] | null;
  dayOfWeekOverride: number | null;
  active: boolean;
  sortOrder: number;
};

export type DeptOpt = { id: string; name: string };
export type WorkerOpt = { id: string; name: string; employeeNo: string | null };

const SHIFT_LABEL: Record<ShiftPolicyRow['shiftType'], string> = {
  DAY: '주간근무',
  NIGHT: '야간근무',
  DAWN: '새벽근무',
};

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function ShiftPoliciesClient({
  rows,
  departments,
  workers,
}: {
  rows: ShiftPolicyRow[];
  departments: DeptOpt[];
  workers: WorkerOpt[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ShiftPolicyRow | 'NEW' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyRows = rows.filter((r) => !r.departmentId && !r.workerId);
  const deptRows = rows.filter((r) => r.departmentId);
  const workerRows = rows.filter((r) => r.workerId);

  async function toggleActive(r: ShiftPolicyRow) {
    setBusy(true);
    const res = await fetch(`/api/shift-policies/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError('변경 실패');
  }

  async function del(r: ShiftPolicyRow) {
    if (!confirm(`'${r.name}' 정책을 삭제하시겠습니까?`)) return;
    setBusy(true);
    const res = await fetch(`/api/shift-policies/${r.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError('삭제 실패');
  }

  function Section({ title, hint, list }: { title: string; hint: string; list: ShiftPolicyRow[] }) {
    return (
      <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 bg-surface-soft border-b border-line">
          <div className="text-sm font-extrabold text-ink">{title}</div>
          <div className="text-[0.6875rem] text-ink-muted font-bold mt-0.5">{hint}</div>
        </div>
        {list.length === 0 ? (
          <div className="p-6 text-center text-sm font-bold text-ink-muted">등록된 정책이 없습니다.</div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-soft text-[0.6875rem] font-mono font-extrabold text-ink uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">대상</th>
                <th className="px-3 py-2 text-left">정책명</th>
                <th className="px-3 py-2 text-left">근무유형</th>
                <th className="px-3 py-2 text-left">출근 인정</th>
                <th className="px-3 py-2 text-left">퇴근 인정</th>
                <th className="px-3 py-2 text-left">휴무 요일</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 font-bold text-ink-muted">{r.workerName ?? r.departmentName ?? '회사 전체'}</td>
                  <td className="px-3 py-2 font-extrabold text-ink">
                    {r.name}
                    {r.dayOfWeekOverride != null && (
                      <span className="ml-1.5 text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/30">
                        {DAY_LABELS[r.dayOfWeekOverride]}요일 전용
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-bold text-ink">{SHIFT_LABEL[r.shiftType]}</td>
                  <td className="px-3 py-2 font-mono font-bold text-ink">
                    {r.checkInRecognizeFrom || r.checkInRecognizeUntil
                      ? `${r.checkInRecognizeFrom ?? '--:--'} ~ ${r.checkInRecognizeUntil ?? '--:--'}`
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-ink">
                    {r.checkOutRecognizeFrom || r.checkOutRecognizeUntil
                      ? `${r.checkOutRecognizeFrom ?? '--:--'} ~ ${r.checkOutRecognizeUntil ?? '--:--'}${r.checkOutNextDay ? ' (익일)' : ''}`
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2 font-bold text-ink">
                    {r.offDays && r.offDays.length > 0
                      ? r.offDays.map((d) => DAY_LABELS[d]).join('')
                      : <span className="text-ink-faint">없음</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[0.6875rem] font-extrabold px-2 py-0.5 rounded border ${r.active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-ink-faint border-slate-300'}`}>
                      {r.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditing(r)} disabled={busy}
                        className="px-2.5 py-1 rounded text-sm font-extrabold border border-accent text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors">수정</button>
                      <button onClick={() => toggleActive(r)} disabled={busy}
                        className="px-2.5 py-1 rounded text-sm font-extrabold border border-slate-400 text-ink-faint hover:bg-slate-100 disabled:opacity-50">
                        {r.active ? '비활성화' : '활성화'}
                      </button>
                      <button onClick={() => del(r)} disabled={busy}
                        className="px-2.5 py-1 rounded text-sm font-extrabold border border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50 transition-colors">삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink">근무유형별 인정시간 설정</h2>
          <p className="text-sm font-bold text-ink-muted mt-1">
            주간/야간/새벽 근무별 출근·퇴근 인정시간을 회사 전체 · 부서(팀) · 개인 단위로 설정합니다.
            적용 우선순위: 개인 &gt; 부서 &gt; 회사 전체.
          </p>
        </div>
        <button onClick={() => setEditing('NEW')}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 shadow-card shrink-0">
          + 정책 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      <Section title="🏢 회사 전체" hint="개인·부서 정책이 없는 근로자에게 적용되는 기본값" list={companyRows} />
      <Section title="🗂 부서·팀별" hint="회사 전체보다 우선 적용" list={deptRows} />
      <Section title="🙋 개인별" hint="가장 우선 적용" list={workerRows} />

      {editing && (
        <ShiftPolicyFormModal
          initial={editing === 'NEW' ? null : editing}
          departments={departments}
          workers={workers}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ShiftPolicyFormModal({
  initial,
  departments,
  workers,
  onCancel,
  onSaved,
}: {
  initial: ShiftPolicyRow | null;
  departments: DeptOpt[];
  workers: WorkerOpt[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const initialScope: 'COMPANY' | 'DEPARTMENT' | 'WORKER' =
    initial?.workerId ? 'WORKER' : initial?.departmentId ? 'DEPARTMENT' : 'COMPANY';
  const [scope, setScope] = useState(initialScope);
  const [deptId, setDeptId] = useState(initial?.departmentId ?? '');
  const [workerId, setWorkerId] = useState(initial?.workerId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [shiftType, setShiftType] = useState<ShiftPolicyRow['shiftType']>(initial?.shiftType ?? 'DAY');
  const [checkInFrom, setCheckInFrom] = useState(initial?.checkInRecognizeFrom ?? '');
  const [checkInUntil, setCheckInUntil] = useState(initial?.checkInRecognizeUntil ?? '');
  const [checkOutFrom, setCheckOutFrom] = useState(initial?.checkOutRecognizeFrom ?? '');
  const [checkOutUntil, setCheckOutUntil] = useState(initial?.checkOutRecognizeUntil ?? '');
  const [checkOutNextDay, setCheckOutNextDay] = useState(initial?.checkOutNextDay ?? false);
  const [offDays, setOffDays] = useState<number[]>(initial?.offDays ?? []);
  const [dayOverride, setDayOverride] = useState<string>(
    initial?.dayOfWeekOverride != null ? String(initial.dayOfWeekOverride) : ''
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError('정책명을 입력하세요.'); return; }
    if (scope === 'DEPARTMENT' && !deptId) { setError('대상 부서를 선택하세요.'); return; }
    if (scope === 'WORKER' && !workerId) { setError('대상 근로자를 선택하세요.'); return; }
    setBusy(true);
    setError(null);
    const body = {
      departmentId: scope === 'DEPARTMENT' ? deptId : null,
      workerId: scope === 'WORKER' ? workerId : null,
      shiftType,
      name: name.trim(),
      checkInRecognizeFrom: checkInFrom || null,
      checkInRecognizeUntil: checkInUntil || null,
      checkOutRecognizeFrom: checkOutFrom || null,
      checkOutRecognizeUntil: checkOutUntil || null,
      checkOutNextDay,
      dayOfWeekOverride: dayOverride === '' ? null : Number(dayOverride),
      offDays: offDays.length > 0 ? offDays : null,
      active,
    };
    const res = await fetch(
      isEdit ? `/api/shift-policies/${initial!.id}` : '/api/shift-policies',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    setBusy(false);
    if (res.ok) onSaved();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? d?.error ?? '저장 실패');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-modal max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
          <h3 className="text-base font-extrabold text-ink flex-1">{isEdit ? '인정시간 정책 수정' : '인정시간 정책 추가'}</h3>
          <button onClick={onCancel} className="text-2xl font-bold text-ink-muted">&times;</button>
        </header>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <span className="block text-[0.6875rem] font-extrabold text-ink tracking-wide">적용 범위 *</span>
            <div className="flex gap-2">
              {([['COMPANY', '회사 전체'], ['DEPARTMENT', '부서·팀'], ['WORKER', '개인']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setScope(val)} disabled={isEdit}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-extrabold border-2 transition-colors disabled:opacity-50 ${scope === val ? 'bg-accent text-white border-accent' : 'bg-surface text-ink-muted border-line hover:border-accent'}`}>
                  {label}
                </button>
              ))}
            </div>
            {isEdit && <p className="text-[0.6875rem] text-ink-muted font-bold">적용 범위는 수정할 수 없습니다 — 범위를 바꾸려면 삭제 후 새로 추가하세요.</p>}
          </div>

          {scope === 'DEPARTMENT' && (
            <Field label="대상 부서·팀 *">
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={isEdit}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent disabled:opacity-50">
                <option value="">— 선택 —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          )}
          {scope === 'WORKER' && (
            <Field label="대상 근로자 *">
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} disabled={isEdit}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent disabled:opacity-50">
                <option value="">— 선택 —</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.employeeNo ? ` (${w.employeeNo})` : ''}</option>)}
              </select>
            </Field>
          )}

          <Field label="정책명 *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 야간조 인정시간"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
          </Field>

          <Field label="근무유형 *">
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value as ShiftPolicyRow['shiftType'])}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent">
              <option value="DAY">주간근무</option>
              <option value="NIGHT">야간근무</option>
              <option value="DAWN">새벽근무</option>
            </select>
          </Field>

          <Field label="적용 요일 (특정 요일만 다른 인정시간을 쓸 때 선택 — 예: 토요일만 단축 근무)">
            <select value={dayOverride} onChange={(e) => setDayOverride(e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent">
              <option value="">매일 (기본 정책)</option>
              {DAY_LABELS.map((label, d) => (
                <option key={d} value={d}>{label}요일 전용</option>
              ))}
            </select>
            {dayOverride !== '' && (
              <p className="text-[0.6875rem] text-ink-muted font-bold mt-1">
                이 정책은 {DAY_LABELS[Number(dayOverride)]}요일에만 적용되고, 다른 요일은 같은 근무유형의
                "매일 (기본 정책)"이 적용됩니다. 기본 정책도 함께 등록해두세요.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="출근 인정 시작">
              <input type="time" value={checkInFrom} onChange={(e) => setCheckInFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
            </Field>
            <Field label="출근 인정 종료 (초과 시 지각)">
              <input type="time" value={checkInUntil} onChange={(e) => setCheckInUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
            </Field>
            <Field label="퇴근 인정 시작 (미달 시 조퇴)">
              <input type="time" value={checkOutFrom} onChange={(e) => setCheckOutFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
            </Field>
            <Field label="퇴근 인정 종료">
              <input type="time" value={checkOutUntil} onChange={(e) => setCheckOutUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
            </Field>
          </div>

          {shiftType === 'NIGHT' && (
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2.5 border border-line">
              <input type="checkbox" checked={checkOutNextDay} onChange={(e) => setCheckOutNextDay(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-line accent-accent" />
              <span className="text-sm font-bold text-ink">퇴근 인정시간은 익일 기준 (전일 출근 → 다음날 퇴근 인정)</span>
            </label>
          )}

          <div className="space-y-2">
            <span className="block text-[0.6875rem] font-extrabold text-ink tracking-wide">휴무 요일 (비워두면 휴무 없음)</span>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, dayNum) => {
                const checked = offDays.includes(dayNum);
                return (
                  <button key={dayNum} type="button"
                    onClick={() => setOffDays(checked ? offDays.filter((d) => d !== dayNum) : [...offDays, dayNum].sort((a, b) => a - b))}
                    className={`w-9 h-9 rounded-full text-sm font-extrabold border-2 transition-colors ${checked ? 'bg-accent text-white border-accent' : 'bg-surface text-ink-muted border-line hover:border-accent'} ${(dayNum === 5 || dayNum === 6) ? 'text-red-500' : ''}`}>
                    {label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setOffDays([5, 6])} className="px-2 py-1 text-[0.625rem] font-bold text-accent border border-accent rounded hover:bg-accent hover:text-white">주말 휴무</button>
              <button type="button" onClick={() => setOffDays([])} className="px-2 py-1 text-[0.625rem] font-bold text-ink-muted border border-line rounded hover:bg-slate-50">초기화</button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-line accent-accent" />
            <span className="text-sm font-extrabold text-ink">정책 활성화</span>
          </label>

          {error && <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-sm font-bold text-red-800">{error}</div>}
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold">취소</button>
          <button onClick={save} disabled={busy || !name.trim()}
            className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
          </button>
        </footer>
      </div>
    </div>
  );
}
