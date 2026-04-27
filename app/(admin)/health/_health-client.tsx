'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Record = {
  lastCheckupDate: string | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  bloodSugar: number | null;
  visionLeft: number | null;
  visionRight: number | null;
  hearingLeft: string | null;
  hearingRight: string | null;
  bloodType: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  emergencyContact: string | null;
  notes: string | null;
};

export type Row = {
  workerId: string;
  workerName: string;
  employeeNo: string | null;
  record: Record | null;
};

export default function HealthClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = rows.filter((r) => r.record).length;

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">건강기록카드 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">
            Plan §3-4 · 의료 정보 — 위탁업체 관리자만 조회 · 모든 접근 audit 기록
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-cyan-50 text-accent border border-accent">
          기록 {filledCount} / {rows.length}명
        </span>
      </header>

      <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
        <strong className="font-extrabold">개인정보보호법 §28 안내</strong> · 본 화면 접근 및 모든 변경은 audit_log에 영구 기록됩니다. 운영 단계에서는 컬럼 단위 AES-256 암호화 + 보존 기간 후 자동 폐기가 적용됩니다.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr>
              {['근로자', '최근 검진', '혈압', '심박', '혈당', '시력', '혈액형', '알레르기', '비상연락', '액션'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink bg-surface-soft border-b-2 border-line-strong font-mono whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.workerId} className={i % 2 === 1 ? 'bg-surface-soft' : ''}>
                <td className="px-3 py-2.5 border-b border-line">
                  <div className="font-bold text-ink">{r.workerName}</div>
                  <div className="text-[10px] font-mono text-ink-muted">{r.employeeNo ?? '—'}</div>
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.lastCheckupDate ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.bloodPressureSys && r.record?.bloodPressureDia
                    ? `${r.record.bloodPressureSys}/${r.record.bloodPressureDia}`
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.heartRate ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.bloodSugar ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.visionLeft != null && r.record?.visionRight != null
                    ? `${r.record.visionLeft.toFixed(1)}/${r.record.visionRight.toFixed(1)}`
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.bloodType ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line text-xs">
                  {r.record?.allergies ? <span className="text-warn font-bold">⚠ 있음</span> : <span className="text-ink-faint">없음</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink truncate max-w-[140px]">
                  {r.record?.emergencyContact ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line">
                  <button
                    onClick={() => { setEditing(r); setError(null); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-extrabold border-2 transition active:scale-95 ${
                      r.record
                        ? 'border-accent text-accent hover:bg-accent hover:text-white'
                        : 'border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white'
                    }`}
                  >
                    {r.record ? '✏ 기록 수정' : '+ 신규 등록'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {editing && (
        <HealthFormModal
          row={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`/api/health/records/${editing.workerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data?.error ?? '저장 실패');
                return false;
              }
              setEditing(null);
              router.refresh();
              return true;
            } catch {
              setError('네트워크 오류');
              return false;
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
    </div>
  );
}

function HealthFormModal({
  row,
  onCancel,
  onSubmit,
  busy,
}: {
  row: Row;
  onCancel: () => void;
  onSubmit: (body: object) => Promise<boolean>;
  busy: boolean;
}) {
  const r = row.record ?? {} as Partial<Record>;
  const [lastCheckupDate, setLastCheckupDate] = useState(r.lastCheckupDate ?? '');
  const [bps, setBps] = useState(r.bloodPressureSys != null ? String(r.bloodPressureSys) : '');
  const [bpd, setBpd] = useState(r.bloodPressureDia != null ? String(r.bloodPressureDia) : '');
  const [hr, setHr] = useState(r.heartRate != null ? String(r.heartRate) : '');
  const [bs, setBs] = useState(r.bloodSugar != null ? String(r.bloodSugar) : '');
  const [vl, setVl] = useState(r.visionLeft != null ? String(r.visionLeft) : '');
  const [vr, setVr] = useState(r.visionRight != null ? String(r.visionRight) : '');
  const [bt, setBt] = useState(r.bloodType ?? '');
  const [allergies, setAllergies] = useState(r.allergies ?? '');
  const [chronic, setChronic] = useState(r.chronicConditions ?? '');
  const [contact, setContact] = useState(r.emergencyContact ?? '');
  const [notes, setNotes] = useState(r.notes ?? '');

  async function save() {
    await onSubmit({
      lastCheckupDate: lastCheckupDate || null,
      bloodPressureSys: bps ? Number(bps) : null,
      bloodPressureDia: bpd ? Number(bpd) : null,
      heartRate: hr ? Number(hr) : null,
      bloodSugar: bs ? Number(bs) : null,
      visionLeft: vl ? Number(vl) : null,
      visionRight: vr ? Number(vr) : null,
      bloodType: bt || null,
      allergies: allergies || null,
      chronicConditions: chronic || null,
      emergencyContact: contact || null,
      notes: notes || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-[600px] bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line">
          <h3 className="text-base font-extrabold text-ink">건강기록 — {row.workerName}</h3>
          <div className="text-[11px] font-mono font-bold text-ink-muted mt-0.5">사번 {row.employeeNo ?? '—'} · 의료 정보 (audit 기록됨)</div>
        </header>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="최근 건강검진일">
              <input type="date" value={lastCheckupDate} onChange={(e) => setLastCheckupDate(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈액형">
              <select value={bt} onChange={(e) => setBt(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="">— 선택 —</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="혈압 수축기 (mmHg)">
              <input type="number" min={50} max={250} value={bps} onChange={(e) => setBps(e.target.value)} placeholder="120" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈압 이완기 (mmHg)">
              <input type="number" min={30} max={180} value={bpd} onChange={(e) => setBpd(e.target.value)} placeholder="80" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="심박수 (bpm)">
              <input type="number" min={30} max={220} value={hr} onChange={(e) => setHr(e.target.value)} placeholder="72" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈당 (mg/dL)">
              <input type="number" min={40} max={600} value={bs} onChange={(e) => setBs(e.target.value)} placeholder="95" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="시력 (좌)">
              <input type="number" step="0.1" min={0} max={2.5} value={vl} onChange={(e) => setVl(e.target.value)} placeholder="1.0" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="시력 (우)">
              <input type="number" step="0.1" min={0} max={2.5} value={vr} onChange={(e) => setVr(e.target.value)} placeholder="1.0" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
          </div>
          <Field label="긴급 비상연락처">
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="배우자 010-0000-0000" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
          </Field>
          <Field label="알레르기">
            <textarea rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="페니실린 / 갑각류 등" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Field label="만성질환">
            <textarea rows={2} value={chronic} onChange={(e) => setChronic(e.target.value)} placeholder="고혈압 / 당뇨 등" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Field label="비고">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button onClick={save} disabled={busy} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[11px] font-extrabold text-ink mb-1.5 tracking-wide'} />;
}
