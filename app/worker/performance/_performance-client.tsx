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

/* @deprecated 과거 저장된 영문 코드(GENERAL/FOOD/RECYCLING/WOOD) 표시용 — 성상은 이제 관리자가 직접 관리(IntakeMaterialCategory) */
const LEGACY_INTAKE_LABEL: Record<string, string> = {
  GENERAL: '일반', FOOD: '음식물', RECYCLING: '재활용', WOOD: '폐목재',
};

type Vehicle = { id: string; vehicleNo: string; vehicleType: string; departmentId: string | null };

type DeptOpt = { id: string; name: string };

type IntakeCategory = { id: string; label: string };

type DisposalSite = { id: string; name: string; address: string | null };

type WasteRecord = {
  id: string; recordDate: string; materialCode: string; weightTon: number;
  note: string | null; disposalSiteId: string | null; disposalSiteName: string | null;
  recorderName: string;
};
type IntakeRecord = {
  id: string; intakeDate: string; intakeTime: string; vehicleId: string;
  vehicleNo: string; materialCategory: string; weightTon: number; note: string | null;
  disposalSiteId: string | null; disposalSiteName: string | null;
  recorderName: string;
};
type OpsRecord = {
  id: string; opsDate: string;
  generalOpHours: number; foodOpHours: number; downtimeHours: number;
  downtimeReason: string | null;
  generalWasteTon: number; foodWasteTon: number;
  generalCollectTon: number; foodCollectTon: number;
  generalTransferTon: number; foodTransferTon: number;
  prevDayPowerKwh: number; notes: string | null;
};

type Props = {
  vehicles: Vehicle[];
  departments?: DeptOpt[];
  isFacilityOperator?: boolean;
  primaryFacility?: { id: string; name: string } | null;
  opsHistory?: OpsRecord[];
};

export default function PerformanceClient({ vehicles, departments = [], isFacilityOperator = false, primaryFacility = null, opsHistory = [] }: Props) {
  const showOps = isFacilityOperator && !!primaryFacility;
  const [tab, setTab] = useState<'waste' | 'intake' | 'ops'>(showOps ? 'ops' : 'waste');

  const tabs = [
    { key: 'waste' as const, label: '📊 처리실적' },
    { key: 'intake' as const, label: '🚚 반입실적' },
    ...(showOps ? [{ key: 'ops' as const, label: '🏭 운전기록' }] : []),
  ];

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">실적관리</h1>
      </div>

      {/* 탭 */}
      <div className={`grid gap-1 bg-surface-soft rounded-lg p-1 border border-line`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 rounded-md text-sm font-extrabold transition ${
              tab === t.key ? 'bg-accent text-white shadow-card' : 'text-ink-muted hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'waste' && <WasteTab />}
      {tab === 'intake' && <IntakeTab vehicles={vehicles} departments={departments} />}
      {tab === 'ops' && showOps && <OpsHistoryTab facility={primaryFacility!} records={opsHistory} />}
    </div>
  );
}

/* ────────────────  처리실적 — 일별 성상별 무게 입력  ──────────────── */

function WasteTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<WasteRecord[]>([]);
  const [disposalSites, setDisposalSites] = useState<DisposalSite[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; note: string; siteId: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/worker/disposal-sites')
      .then((r) => r.json())
      .then((d) => setDisposalSites(d.items ?? []))
      .catch(() => {});
  }, []);

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
          weightTon: Number(weight) / 1000,
          note: draft.note?.trim() || undefined,
          disposalSiteId: draft.siteId || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? '저장 실패');
        return;
      }
      setSuccess(`${MAT_LABEL[materialCode]} ${weight}kg 저장됨`);
      setDrafts((p) => ({ ...p, [materialCode]: { weight: '', note: '', siteId: '' } }));
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
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
        />
      </Section>

      {/* 합계 */}
      <div className="bg-accent/10 border border-accent rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-accent">📊 오늘 합계</span>
        <span className="font-mono text-2xl font-black text-accent">
          {(total * 1000).toFixed(0)}<span className="text-sm ml-1 font-bold">kg</span>
        </span>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-sm font-bold text-success">✓ {success}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 성상별 입력 */}
      <Section label="성상별 입력">
        <div className="space-y-2">
          {WASTE_MATERIALS.map((m) => {
            const existing = byMaterial.get(m.code);
            const draft = drafts[m.code] ?? { weight: '', note: '', siteId: existing?.disposalSiteId ?? '' };
            const isOpen = !!draft.weight || !!existing;
            return (
              <div key={m.code} className={`rounded-lg border-2 transition ${existing ? 'border-emerald-300 bg-emerald-50' : 'border-line bg-surface'}`}>
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xl flex-shrink-0">{m.emoji}</span>
                  <span className="flex-1 text-sm font-extrabold text-ink">{m.label}</span>
                  {existing ? (
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-emerald-700">✓ {Math.round(Number(existing.weightTon) * 1000)}kg</div>
                      {existing.disposalSiteName && (
                        <div className="text-[0.625rem] text-emerald-600 font-semibold">{existing.disposalSiteName}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm font-mono text-ink-muted">미입력</span>
                  )}
                </div>
                <div className="px-3 pb-2.5 flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={draft.weight}
                    onChange={(e) => setDrafts((p) => ({ ...p, [m.code]: { ...draft, weight: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-md border border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                  />
                  <span className="self-center text-xs font-mono font-bold text-ink-muted">kg</span>
                  <button
                    type="button"
                    onClick={() => save(m.code)}
                    disabled={saving === m.code || !draft.weight}
                    className="px-3 py-2 rounded-md bg-accent text-white text-sm font-extrabold disabled:opacity-50 active:scale-95"
                  >
                    {saving === m.code ? '저장중' : (existing ? '갱신' : '저장')}
                  </button>
                </div>
                {disposalSites.length > 0 && (
                  <div className="px-3 pb-1.5">
                    <select
                      value={draft.siteId}
                      onChange={(e) => setDrafts((p) => ({ ...p, [m.code]: { ...draft, siteId: e.target.value } }))}
                      className="w-full px-3 py-1.5 rounded-md border border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                    >
                      <option value="">— 반입장소 선택 (선택사항) —</option>
                      {disposalSites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.address ? ` (${s.address})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isOpen && (
                  <div className="px-3 pb-2.5">
                    <input
                      type="text"
                      placeholder="비고 (선택)"
                      value={draft.note}
                      onChange={(e) => setDrafts((p) => ({ ...p, [m.code]: { ...draft, note: e.target.value } }))}
                      className="w-full px-3 py-1.5 rounded-md border border-line text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
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

/* ────────────────  반입실적 — 차량 단위 입력  ──────────────── */

function IntakeTab({ vehicles, departments }: { vehicles: Vehicle[]; departments: DeptOpt[] }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<IntakeRecord[]>([]);
  const [disposalSites, setDisposalSites] = useState<DisposalSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [categories, setCategories] = useState<IntakeCategory[]>([]);
  const [deptId, setDeptId] = useState<string>('');
  const filteredVehicles = deptId ? vehicles.filter((v) => v.departmentId === deptId) : vehicles;
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [category, setCategory] = useState<string>('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/worker/disposal-sites')
      .then((r) => r.json())
      .then((d) => setDisposalSites(d.items ?? []))
      .catch(() => {});
    fetch('/api/worker/intake-categories')
      .then((r) => r.json())
      .then((d) => {
        const list: IntakeCategory[] = d.items ?? [];
        setCategories(list);
        setCategory((prev) => prev || list[0]?.label || '');
      })
      .catch(() => {});
  }, []);

  /* 부서 필터 변경 시 선택 차량이 목록에서 벗어나면 첫 차량으로 재설정 */
  useEffect(() => {
    if (!filteredVehicles.some((v) => v.id === vehicleId)) {
      setVehicleId(filteredVehicles[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId]);

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
          weightTon: Number(weight) / 1000,
          note: note.trim() || undefined,
          disposalSiteId: selectedSiteId || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? '저장 실패');
        return;
      }
      const v = vehicles.find((x) => x.id === vehicleId);
      setSuccess(`${v?.vehicleNo} ${category} ${weight}kg 저장됨`);
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
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
        />
      </Section>

      <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-emerald-700">🚚 오늘 합계 ({items.length}건)</span>
        <span className="font-mono text-2xl font-black text-emerald-700">
          {(total * 1000).toFixed(0)}<span className="text-sm ml-1 font-bold">kg</span>
        </span>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-sm font-bold text-success">✓ {success}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm font-bold text-red-700">{error}</div>
      )}

      <Section label="신규 입력">
        {vehicles.length === 0 ? (
          <div className="text-sm text-warn font-bold p-3 bg-amber-50 rounded">⚠️ 등록된 차량이 없습니다. 관리자에게 문의하세요.</div>
        ) : (
          <div className="space-y-2.5">
            {departments.length > 0 && (
              <Field label="부서">
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                >
                  <option value="">— 전체 부서 —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
            )}

            {categories.length > 0 && (
              <Field label="성상">
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.label)}
                      className={`px-3 py-2.5 rounded-lg border-2 text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition ${
                        category === c.label
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface text-ink hover:bg-surface-soft'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="차량">
              {filteredVehicles.length === 0 ? (
                <div className="text-sm text-warn font-bold p-2.5 bg-amber-50 rounded-lg">해당 부서에 배정된 차량이 없습니다.</div>
              ) : (
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                >
                  {filteredVehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.vehicleNo} ({v.vehicleType})</option>
                  ))}
                </select>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="반입 시각">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                />
              </Field>
              <Field label="무게(kg)">
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                />
              </Field>
            </div>

            {disposalSites.length > 0 && (
              <Field label="반입장소">
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                >
                  <option value="">— 선택 안함 —</option>
                  {disposalSites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.address ? ` (${s.address})` : ''}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="비고 (선택)">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 지역 표시, 특이사항"
                className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
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
              <div key={it.id} className="bg-surface-soft border border-line rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-ink-muted w-12 flex-shrink-0">{it.intakeTime?.slice(0, 5) ?? '--:--'}</span>
                  <span className="font-extrabold text-ink truncate flex-1">{it.vehicleNo}</span>
                  <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{LEGACY_INTAKE_LABEL[it.materialCategory] ?? it.materialCategory}</span>
                  <span className="font-mono font-black text-accent flex-shrink-0">{Math.round(Number(it.weightTon) * 1000)}kg</span>
                </div>
                {it.disposalSiteName && (
                  <div className="mt-0.5 ml-14 text-[0.625rem] text-emerald-600 font-semibold">📍 {it.disposalSiteName}</div>
                )}
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
      <div className="px-4 py-2.5 border-b border-line bg-surface-soft text-[0.75rem] font-extrabold text-ink tracking-tight">
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as _F } from '@/components/Field';
const Field = (p: React.ComponentProps<typeof _F>) => <_F {...p} labelClassName={p.labelClassName ?? 'block text-sm font-mono font-extrabold text-ink-faint mb-1'} />;

/* ────────────────  운전기록 이력  ──────────────── */

const OPS_FIELDS = [
  ['generalOpHours',   '일반가동(h)'],
  ['foodOpHours',      '음식가동(h)'],
  ['downtimeHours',    '비가동(h)'],
  ['generalWasteTon',  '일반처리(t)'],
  ['foodWasteTon',     '음식처리(t)'],
  ['generalCollectTon','일반수거(t)'],
  ['foodCollectTon',   '음식수거(t)'],
  ['generalTransferTon','일반반출(t)'],
  ['foodTransferTon',  '음식반출(t)'],
  ['prevDayPowerKwh',  '전일전력(kWh)'],
] as const;

type OpsFormKey = typeof OPS_FIELDS[number][0];
type OpsForm = Record<OpsFormKey, string> & { downtimeReason: string; notes: string };

function emptyForm(): OpsForm {
  return {
    generalOpHours: '', foodOpHours: '', downtimeHours: '',
    generalWasteTon: '', foodWasteTon: '',
    generalCollectTon: '', foodCollectTon: '',
    generalTransferTon: '', foodTransferTon: '',
    prevDayPowerKwh: '',
    downtimeReason: '', notes: '',
  };
}

function OpsHistoryTab({ facility, records: initialRecords }: { facility: { id: string; name: string }; records: OpsRecord[] }) {
  const [records, setRecords] = useState<OpsRecord[]>(initialRecords);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [opsDate, setOpsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<OpsForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function set(key: keyof OpsForm, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }
  function toNum(v: string) { return parseFloat(v) || 0; }

  async function save() {
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/super-admin/facility-ops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          facilityId: facility.id,
          opsDate,
          generalOpHours: toNum(form.generalOpHours),
          foodOpHours: toNum(form.foodOpHours),
          downtimeHours: toNum(form.downtimeHours),
          downtimeReason: form.downtimeReason || undefined,
          generalWasteTon: toNum(form.generalWasteTon),
          foodWasteTon: toNum(form.foodWasteTon),
          generalCollectTon: toNum(form.generalCollectTon),
          foodCollectTon: toNum(form.foodCollectTon),
          generalTransferTon: toNum(form.generalTransferTon),
          foodTransferTon: toNum(form.foodTransferTon),
          prevDayPowerKwh: toNum(form.prevDayPowerKwh),
          notes: form.notes || undefined,
        }),
      });
      if (res.ok) {
        setMsg('✅ 저장 완료');
        setForm(emptyForm());
        setShowForm(false);
        // 목록 새로고침
        const d = await fetch(`/api/super-admin/facility-ops?facilityId=${facility.id}&from=${(() => { const t = new Date(); t.setDate(t.getDate() - 29); return t.toISOString().slice(0, 10); })()}&to=${new Date().toISOString().slice(0, 10)}`).then((r) => r.json());
        setRecords(
          (d.items ?? []).map((r: { id: string; opsDate: string; generalOpHours: string; foodOpHours: string; downtimeHours: string; downtimeReason: string | null; generalWasteTon: string; foodWasteTon: string; generalCollectTon: string; foodCollectTon: string; generalTransferTon: string; foodTransferTon: string; prevDayPowerKwh: string; notes: string | null }) => ({
            id: r.id, opsDate: r.opsDate,
            generalOpHours: Number(r.generalOpHours), foodOpHours: Number(r.foodOpHours),
            downtimeHours: Number(r.downtimeHours), downtimeReason: r.downtimeReason,
            generalWasteTon: Number(r.generalWasteTon), foodWasteTon: Number(r.foodWasteTon),
            generalCollectTon: Number(r.generalCollectTon), foodCollectTon: Number(r.foodCollectTon),
            generalTransferTon: Number(r.generalTransferTon), foodTransferTon: Number(r.foodTransferTon),
            prevDayPowerKwh: Number(r.prevDayPowerKwh), notes: r.notes,
          }))
        );
      } else {
        setMsg('❌ 저장 실패. 다시 시도해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 + 입력 토글 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-extrabold text-ink-muted">{facility.name}</span>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setMsg(''); }}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-extrabold active:scale-95"
        >
          {showForm ? '✕ 닫기' : '+ 운전기록 입력'}
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-surface border-2 border-indigo-300 rounded-xl shadow-card p-4 space-y-3">
          <div className="text-sm font-extrabold text-indigo-800">📋 운전기록 입력</div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-extrabold text-ink-muted">운영일자</span>
            <input type="date" value={opsDate} onChange={(e) => setOpsDate(e.target.value)} className="border border-line rounded px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {OPS_FIELDS.map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-sm font-extrabold text-ink-muted">{label}</span>
                <input
                  type="number" min="0" step="0.01"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="border border-line rounded px-2 py-1.5 text-sm text-right"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm font-extrabold text-ink-muted">비가동 사유</span>
              <input value={form.downtimeReason} onChange={(e) => set('downtimeReason', e.target.value)} className="border border-line rounded px-2 py-1.5 text-sm" placeholder="선택 사항" />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm font-extrabold text-ink-muted">비고</span>
              <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="border border-line rounded px-2 py-1.5 text-sm" placeholder="선택 사항" />
            </label>
          </div>
          {msg && <p className={`text-sm font-bold ${msg.startsWith('✅') ? 'text-success' : 'text-danger'}`}>{msg}</p>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white text-sm font-extrabold disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      )}

      {/* 이력 목록 */}
      {msg && !showForm && <p className={`text-sm font-bold px-1 ${msg.startsWith('✅') ? 'text-success' : 'text-danger'}`}>{msg}</p>}

      {records.length === 0 ? (
        <div className="text-center py-12 text-ink-muted">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm mt-1">아직 입력된 운전기록이 없습니다</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-extrabold text-ink-muted px-1">최근 {records.length}건</div>
          {records.map((r) => {
            const isOpen = expanded === r.id;
            const totalWaste = r.generalWasteTon + r.foodWasteTon;
            const totalOp = r.generalOpHours + r.foodOpHours;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="w-full text-left bg-surface border border-line rounded-xl shadow-card overflow-hidden active:scale-[0.99] transition"
              >
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm text-ink">{r.opsDate}</div>
                    <div className="text-sm text-ink-muted mt-0.5">
                      처리 {totalWaste.toFixed(2)}t · 가동 {totalOp.toFixed(1)}h · 전력 {r.prevDayPowerKwh.toFixed(0)}kWh
                    </div>
                  </div>
                  {r.downtimeHours > 0 && (
                    <span className="text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">
                      비가동 {r.downtimeHours}h
                    </span>
                  )}
                  <span className="text-ink-muted text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-line bg-surface-soft">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      {([
                        ['일반 가동시간', `${r.generalOpHours}h`],
                        ['음식물 가동시간', `${r.foodOpHours}h`],
                        ['비가동시간', `${r.downtimeHours}h`],
                        ['일반 처리량', `${r.generalWasteTon}t`],
                        ['음식물 처리량', `${r.foodWasteTon}t`],
                        ['일반 수거량', `${r.generalCollectTon}t`],
                        ['음식물 수거량', `${r.foodCollectTon}t`],
                        ['일반 반출량', `${r.generalTransferTon}t`],
                        ['음식물 반출량', `${r.foodTransferTon}t`],
                        ['전일 전력', `${r.prevDayPowerKwh}kWh`],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-2">
                          <span className="text-ink-muted">{label}</span>
                          <span className="font-bold text-ink">{value}</span>
                        </div>
                      ))}
                    </div>
                    {r.downtimeReason && <div className="mt-2 text-sm text-amber-700 font-bold">비가동 사유: {r.downtimeReason}</div>}
                    {r.notes && <div className="mt-1 text-sm text-ink-muted">비고: {r.notes}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
