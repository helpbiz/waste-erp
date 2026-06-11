'use client';

import { useEffect, useState } from 'react';
import type { PayrollPolicyData } from '@/lib/payroll-policy';

type Candidate = { id: string; name: string; role: string };
type Props = { initialPolicy: PayrollPolicyData };

const HOUR_OPTS = Array.from({ length: 24 }, (_, i) => i);

export default function PolicyTab({ initialPolicy }: Props) {
  const [form, setForm]     = useState<PayrollPolicyData>(initialPolicy);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillYm, setPrefillYm]   = useState('');
  const [prefillMsg, setPrefillMsg] = useState<string | null>(null);
  const [prefillErr, setPrefillErr] = useState<string | null>(null);

  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => { setPrefillYm(defaultYm); }, [defaultYm]);

  useEffect(() => {
    fetch('/api/payroll/policy')
      .then((r) => r.json())
      .then((d) => {
        if (d.approverCandidates) setCandidates(d.approverCandidates);
        /* 최신 서버 상태로 form 동기화 (approverId 포함) */
        if (d.policy) setForm((f) => ({ ...f, payslipApproverId: d.policy.payslipApproverId ?? null }));
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof PayrollPolicyData>(key: K, val: PayrollPolicyData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/payroll/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '저장 실패');
      } else {
        setSuccess('✓ 정책이 저장되었습니다.');
        setForm(data.policy);
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function handlePrefill() {
    if (!prefillYm) return;
    if (!confirm(`${prefillYm} 마감된 근태 집계를 기반으로 급여명세서 초안을 자동 생성하시겠습니까?`)) return;
    setPrefilling(true); setPrefillMsg(null); setPrefillErr(null);
    try {
      const res = await fetch('/api/payroll/payslips/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearMonth: prefillYm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPrefillErr(data.message ?? data.error ?? '초안 생성 실패');
      } else {
        setPrefillMsg(data.message);
      }
    } catch {
      setPrefillErr('네트워크 오류');
    } finally {
      setPrefilling(false);
    }
  }

  const nightLabel = `${String(form.nightStartHour).padStart(2, '0')}:00 ~ ${String(form.nightEndHour).padStart(2, '0')}:00 (익일)`;

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── 1. 근로시간 기준 ───────────────────────────────── */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-ink tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-accent text-white text-[0.625rem] flex items-center justify-center font-black">1</span>
          근로시간 기준
        </h3>

        <Field label="1일 기본 근무시간" note="연장근로 기산점 (근로기준법 §56: 8시간 초과)">
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={12} step={0.5}
              value={form.dailyWorkHours}
              onChange={(e) => set('dailyWorkHours', parseFloat(e.target.value) || 8)}
              className="w-24 px-3 py-2 rounded-md border border-line font-mono font-bold text-sm text-ink focus:outline-none focus:border-accent"
            />
            <span className="text-sm font-bold text-ink-muted">시간</span>
          </div>
        </Field>

        <Field label="야간근로 시간대" note={`현재 설정: ${nightLabel}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={form.nightStartHour}
              onChange={(e) => set('nightStartHour', parseInt(e.target.value))}
              className="px-3 py-2 rounded-md border border-line font-mono font-bold text-sm text-ink bg-surface focus:outline-none focus:border-accent"
            >
              {HOUR_OPTS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <span className="text-sm font-bold text-ink-muted">~</span>
            <select
              value={form.nightEndHour}
              onChange={(e) => set('nightEndHour', parseInt(e.target.value))}
              className="px-3 py-2 rounded-md border border-line font-mono font-bold text-sm text-ink bg-surface focus:outline-none focus:border-accent"
            >
              {HOUR_OPTS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <span className="text-sm font-bold text-ink-muted">(익일)</span>
          </div>
          <p className="text-[0.6875rem] text-info mt-1 font-semibold">
            출퇴근 시각에서 이 구간에 해당하는 시간을 자동으로 야간근로로 계산합니다.
          </p>
        </Field>
      </section>

      {/* ── 2. 가산율 ─────────────────────────────────────── */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-ink tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-warn text-white text-[0.625rem] flex items-center justify-center font-black">2</span>
          가산임금 배율
          <span className="text-[0.625rem] font-mono text-ink-faint">(근로기준법 §56 기본값: 연장/휴일 1.5, 야간 0.5)</span>
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <MultiplierField
            label="연장근로"
            value={form.overtimeMultiplier}
            onChange={(v) => set('overtimeMultiplier', v)}
            note="×1.5"
          />
          <MultiplierField
            label="야간근로"
            value={form.nightMultiplier}
            onChange={(v) => set('nightMultiplier', v)}
            note="+0.5"
          />
          <MultiplierField
            label="휴일근로"
            value={form.holidayMultiplier}
            onChange={(v) => set('holidayMultiplier', v)}
            note="×1.5"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-[0.6875rem] text-info font-semibold">
          예시: 시급 10,000원 · 야간 2h → 10,000 × {form.nightMultiplier} × 2 = {(10000 * form.nightMultiplier * 2).toLocaleString('ko-KR')}원 추가
        </div>
      </section>

      {/* ── 3. 결재승인권자 지정 ──────────────────────────── */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-ink tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-danger text-white text-[0.625rem] flex items-center justify-center font-black">3</span>
          급여명세서 결재승인권자
        </h3>
        <p className="text-sm text-ink-muted font-semibold leading-relaxed">
          승인권자를 지정하면 해당 담당자의 결재 없이는 급여명세서를 발송할 수 없습니다.<br />
          지정하지 않으면 관리자가 즉시 발송할 수 있습니다.
        </p>
        <Field label="결재승인권자">
          <select
            value={form.payslipApproverId ?? ''}
            onChange={(e) => set('payslipApproverId', e.target.value || null)}
            className="w-full px-3 py-2 rounded-md border border-line font-bold text-sm text-ink bg-surface focus:outline-none focus:border-accent"
          >
            <option value="">없음 (승인 없이 즉시 발송)</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.role === 'CONTRACTOR_ADMIN' ? '업체관리자' : '내부관리자'})
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="text-[0.6875rem] text-ink-muted mt-1">이 업체에 관리자 계정이 없습니다.</p>
          )}
        </Field>
      </section>

      {/* ── 저장 버튼 ─────────────────────────────────────── */}
      <div>
        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-accent text-white font-extrabold text-sm hover:bg-cyan-800 active:scale-[0.99] disabled:opacity-50 transition"
        >
          {busy ? '저장 중…' : '💾 정책 저장'}
        </button>
        {error   && <p className="mt-2 text-sm font-bold text-danger">{error}</p>}
        {success && <p className="mt-2 text-sm font-bold text-success">{success}</p>}
      </div>

      <hr className="border-line" />

      {/* ── 4. 급여명세서 초안 자동 생성 ─────────────────── */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-ink tracking-tight flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-success text-white text-[0.625rem] flex items-center justify-center font-black">4</span>
          급여명세서 초안 자동 생성
        </h3>
        <p className="text-sm text-ink-muted font-semibold leading-relaxed">
          마감 완료된 근태 집계(출근일수·연장·야간)를 급여명세서 초안으로 자동 채워줍니다.
          <br />기본급 등 금액은 Excel 업로드 또는 직접 입력으로 추가 작성하면 됩니다.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={prefillYm}
            onChange={(e) => setPrefillYm(e.target.value)}
            className="px-3 py-2 rounded-md border border-line font-mono font-bold text-sm text-ink focus:outline-none focus:border-accent"
          />
          <button
            onClick={handlePrefill}
            disabled={prefilling || !prefillYm}
            className="px-5 py-2 rounded-md bg-success text-white font-extrabold text-sm hover:bg-green-700 active:scale-[0.99] disabled:opacity-50 transition"
          >
            {prefilling ? '생성 중…' : '⚡ 초안 자동 생성'}
          </button>
        </div>

        {prefillErr && (
          <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-sm font-bold text-danger">{prefillErr}</div>
        )}
        {prefillMsg && (
          <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-sm font-bold text-success">{prefillMsg}</div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[0.6875rem] text-amber-800 font-semibold leading-relaxed">
          ※ 이미 <strong>발송 완료</strong>된 명세서는 덮어쓰지 않습니다.<br />
          ※ 초안 생성 후 금액을 확인·수정한 뒤 발송 탭에서 발송하세요.
        </div>
      </section>
    </div>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-extrabold text-ink">{label}</span>
        {note && <span className="text-[0.625rem] font-mono text-ink-faint">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function MultiplierField({
  label, value, onChange, note,
}: { label: string; value: number; onChange: (v: number) => void; note: string }) {
  return (
    <div className="bg-surface-soft border border-line rounded-lg p-3 text-center space-y-1">
      <div className="text-[0.625rem] font-extrabold text-ink-muted tracking-widest uppercase">{label}</div>
      <input
        type="number" min={0} max={3} step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full text-center px-2 py-1.5 rounded-md border border-line font-mono font-extrabold text-lg text-ink focus:outline-none focus:border-accent bg-surface"
      />
      <div className="text-[0.6875rem] font-mono text-ink-faint">{note}</div>
    </div>
  );
}
