'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const WASTE_MATERIALS = [
  { code: 'GENERAL',       label: '일반',        emoji: '🗑' },
  { code: 'FOOD',          label: '음식물',      emoji: '🍎' },
  { code: 'RECYCLING',     label: '재활용',      emoji: '♻️' },
  { code: 'WOOD',          label: '폐목재',      emoji: '🪵' },
  { code: 'COAL_ASH',      label: '연탄재',      emoji: '⬛' },
  { code: 'MIXED_BLDG',    label: '혼합건폐',    emoji: '🧱' },
  { code: 'PLASTIC',       label: '합성수지',    emoji: '🧴' },
  { code: 'BATTERY',       label: '폐건전지',    emoji: '🔋' },
  { code: 'FLUORESCENT',   label: '폐형광등',    emoji: '💡' },
  { code: 'MILK_CARTON',   label: '우유팩',      emoji: '🥛' },
  { code: 'VINYL',         label: '폐비닐',      emoji: '🛍' },
  { code: 'POCKET_SPRING', label: '포켓스프링',  emoji: '🛏' },
  { code: 'SCRAP_IRON',    label: '잡철',        emoji: '⛓' },
  { code: 'STYROFOAM',     label: '스티로폼',    emoji: '⬜' },
];

const INTAKE_CATEGORIES = [
  { code: 'GENERAL',   label: '일반',    emoji: '🗑' },
  { code: 'FOOD',      label: '음식물',  emoji: '🍎' },
  { code: 'RECYCLING', label: '재활용',  emoji: '♻️' },
  { code: 'WOOD',      label: '폐목재',  emoji: '🪵' },
];

type Vehicle = { id: string; vehicleNo: string; vehicleType: string };

type WasteRecord = {
  id: string; recordDate: string; materialCode: string; weightTon: number;
  note: string | null; recorderName: string;
};
type IntakeRecord = {
  id: string; intakeDate: string; intakeTime: string; vehicleId: string;
  vehicleNo: string; materialCategory: string; weightTon: number; note: string | null;
  recorderName: string;
};

export default function PerformanceClient({ vehicles }: { vehicles: Vehicle[] }) {
  const [tab, setTab] = useState<'waste' | 'intake'>('waste');

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">실적관리</h1>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-2 gap-1 bg-surface-soft rounded-lg p-1 border border-line">
        <button
          onClick={() => setTab('waste')}
          className={`py-2.5 rounded-md text-sm font-extrabold transition ${
            tab === 'waste' ? 'bg-accent text-white shadow-card' : 'text-ink-muted hover:bg-surface'
          }`}
        >
          📊 처리실적
        </button>
        <button
          onClick={() => setTab('intake')}
          className={`py-2.5 rounded-md text-sm font-extrabold transition ${
            tab === 'intake' ? 'bg-accent text-white shadow-card' : 'text-ink-muted hover:bg-surface'
          }`}
        >
          🚚 반입실적
        </button>
      </div>

      {tab === 'waste' && <WasteTab />}
      {tab === 'intake' && <IntakeTab vehicles={vehicles} />}
    </div>
  );
}

/* ────────────────  처리실적 — 일별 성상별 무게 입력  ──────────────── */

function WasteTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<WasteRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; note: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/waste-records?from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const byMaterial = new Map<string, WasteRecord>();
  for (const r of items.filter((i) => i.recordDate === date)) byMaterial.set(r.materialCode, r);

  async function save(materialCode: string) {
    const draft = drafts[materialCode];
    if (!draft || !draft.weight) {
      setError('무게(톤)를 입력해 주세요.');
      return;
    }
    const weight = Number(draft.weight);
    if (isNaN(weight) || weight < 0) {
      setError('올바른 무게를 입력해 주세요.');
      return;
    }
    setSaving(materialCode);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch('/api/waste-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordDate: date,
          materialCode,
          weightTon: weight,
          note: draft.note?.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? '저장 실패');
        return;
      }
      setSuccess(`${MAT_LABEL[materialCode]} ${weight}t 저장됨`);
      setDrafts((p) => ({ ...p, [materialCode]: { weight: '', note: '' } }));
      load();
    } finally {
      setSaving(null);
    }
  }

  const total = items.reduce((s, i) => s + Number(i.weightTon), 0);

  return (
    <div className="space-y-3">
      {/* 날짜 선택 */}
      <Section label="작업 날짜">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
        />
      </Section>

      {/* 합계 */}
      <div className="bg-accent/10 border border-accent rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-extrabold text-accent">📊 오늘 합계</span>
        <span className="font-mono text-2xl font-black text-accent">
          {total.toFixed(2)}<span className="text-xs ml-1 font-bold">톤</span>
        </span>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-xs font-bold text-success">✓ {success}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>
      )}

      {/* 성상별 입력 */}
      <Section label="성상별 입력">
        <div className="space-y-2">
          {WASTE_MATERIALS.map((m) => {
            const existing = byMaterial.get(m.code);
            const draft = drafts[m.code] ?? { weight: '', note: '' };
            const isOpen = !!draft.weight || !!existing;
            return (
              <div key={m.code} className={`rounded-lg border-2 transition ${existing ? 'border-emerald-300 bg-emerald-50' : 'border-line bg-surface'}`}>
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xl flex-shrink-0">{m.emoji}</span>
                  <span className="flex-1 text-sm font-extrabold text-ink">{m.label}</span>
                  {existing ? (
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      ✓ {Number(existing.weightTon).toFixed(2)}t
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-ink-muted">미입력</span>
                  )}
                </div>
                <div className="px-3 pb-2.5 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={draft.weight}
                    onChange={(e) => setDrafts((p) => ({ ...p, [m.code]: { ...draft, weight: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-md border border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
                  />
                  <span className="self-center text-xs font-mono font-bold text-ink-muted">톤</span>
                  <button
                    type="button"
                    onClick={() => save(m.code)}
                    disabled={saving === m.code || !draft.weight}
                    className="px-3 py-2 rounded-md bg-accent text-white text-xs font-extrabold disabled:opacity-50 active:scale-95"
                  >
                    {saving === m.code ? '저장중' : (existing ? '갱신' : '저장')}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-3 pb-2.5">
                    <input
                      type="text"
                      placeholder="비고 (선택)"
                      value={draft.note}
                      onChange={(e) => setDrafts((p) => ({ ...p, [m.code]: { ...draft, note: e.target.value } }))}
                      className="w-full px-3 py-1.5 rounded-md border border-line text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

const MAT_LABEL: Record<string, string> = Object.fromEntries(WASTE_MATERIALS.map((m) => [m.code, m.label]));
const CAT_LABEL: Record<string, string> = Object.fromEntries(INTAKE_CATEGORIES.map((m) => [m.code, m.label]));

/* ────────────────  반입실적 — 차량 단위 입력  ──────────────── */

function IntakeTab({ vehicles }: { vehicles: Vehicle[] }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<IntakeRecord[]>([]);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [category, setCategory] = useState<string>('GENERAL');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/recycling-intake?from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  async function save() {
    if (!vehicleId) { setError('차량을 선택해 주세요.'); return; }
    if (!weight || Number(weight) <= 0) { setError('무게(톤)를 입력해 주세요.'); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch('/api/recycling-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeDate: date,
          intakeTime: time,
          vehicleId,
          materialCategory: category,
          weightTon: Number(weight),
          note: note.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? '저장 실패');
        return;
      }
      const v = vehicles.find((x) => x.id === vehicleId);
      setSuccess(`${v?.vehicleNo} ${CAT_LABEL[category]} ${weight}t 저장됨`);
      setWeight('');
      setNote('');
      load();
    } finally {
      setSaving(false);
    }
  }

  const total = items.reduce((s, i) => s + Number(i.weightTon), 0);

  return (
    <div className="space-y-3">
      <Section label="작업 날짜">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
        />
      </Section>

      <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-extrabold text-emerald-700">🚚 오늘 합계 ({items.length}건)</span>
        <span className="font-mono text-2xl font-black text-emerald-700">
          {total.toFixed(2)}<span className="text-xs ml-1 font-bold">톤</span>
        </span>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-xs font-bold text-success">✓ {success}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>
      )}

      <Section label="신규 입력">
        {vehicles.length === 0 ? (
          <div className="text-xs text-warn font-bold p-3 bg-amber-50 rounded">⚠️ 등록된 차량이 없습니다. 관리자에게 문의하세요.</div>
        ) : (
          <div className="space-y-2.5">
            <Field label="차량">
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-bold focus:outline-none focus:border-accent"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.vehicleNo} ({v.vehicleType})</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="반입 시각">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
                />
              </Field>
              <Field label="무게(톤)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
                />
              </Field>
            </div>

            <Field label="성상">
              <div className="grid grid-cols-2 gap-2">
                {INTAKE_CATEGORIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCategory(c.code)}
                    className={`px-3 py-2.5 rounded-lg border-2 text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition ${
                      category === c.code
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-ink hover:bg-surface-soft'
                    }`}
                  >
                    <span>{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="비고 (선택)">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 지역 표시, 특이사항"
                className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              />
            </Field>

            <button
              type="button"
              onClick={save}
              disabled={saving || !vehicleId || !weight}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-base font-black shadow-card active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? '저장 중…' : '🚚 반입실적 저장'}
            </button>
          </div>
        )}
      </Section>

      {/* 오늘 입력 이력 */}
      {items.length > 0 && (
        <Section label={`오늘 입력 이력 (${items.length}건)`}>
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} className="bg-surface-soft border border-line rounded-md px-3 py-2 flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-ink-muted w-12 flex-shrink-0">{it.intakeTime?.slice(0, 5) ?? '--:--'}</span>
                <span className="font-extrabold text-ink truncate flex-1">{it.vehicleNo}</span>
                <span className="text-xs font-bold text-emerald-700 flex-shrink-0">{CAT_LABEL[it.materialCategory] ?? it.materialCategory}</span>
                <span className="font-mono font-black text-accent flex-shrink-0">{Number(it.weightTon).toFixed(2)}t</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ────────────────  공용  ──────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line bg-surface-soft text-[12px] font-extrabold text-ink tracking-tight">
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-xs font-mono font-extrabold text-slate-600 mb-1'} />;
}
