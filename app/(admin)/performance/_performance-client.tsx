'use client';

// Design Ref: §5.1.2 — 처리시설 드롭다운 + 일자별 카드 PDF 출력 버튼 (FR-08)
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FacilitySelect } from '@/components/FacilitySelect';

const WASTE_MATERIALS = [
  { code: 'GENERAL',       label: '일반' },
  { code: 'FOOD',          label: '음식물' },
  { code: 'RECYCLING',     label: '재활용' },
  { code: 'WOOD',          label: '폐목재' },
  { code: 'COAL_ASH',      label: '연탄재' },
  { code: 'MIXED_BLDG',    label: '혼합건폐' },
  { code: 'PLASTIC',       label: '합성수지' },
  { code: 'BATTERY',       label: '폐건전지' },
  { code: 'FLUORESCENT',   label: '폐형광등' },
  { code: 'MILK_CARTON',   label: '우유팩' },
  { code: 'VINYL',         label: '폐비닐' },
  { code: 'POCKET_SPRING', label: '포켓스프링' },
  { code: 'SCRAP_IRON',    label: '잡철' },
  { code: 'STYROFOAM',     label: '스티로폼' },
];
const MATERIAL_LABEL: Record<string, string> = Object.fromEntries(WASTE_MATERIALS.map((m) => [m.code, m.label]));

const INTAKE_CATEGORIES = [
  { code: 'GENERAL',   label: '일반' },
  { code: 'FOOD',      label: '음식물' },
  { code: 'RECYCLING', label: '재활용' },
  { code: 'WOOD',      label: '폐목재' },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(INTAKE_CATEGORIES.map((m) => [m.code, m.label]));

type WasteRecord = {
  id: string; recordDate: string; materialCode: string; weightTon: number;
  note: string | null; recorderName: string; recorderRole: string;
};
type IntakeRecord = {
  id: string; intakeDate: string; intakeTime: string; vehicleId: string;
  vehicleNo: string; materialCategory: string; weightTon: number; note: string | null;
  recorderName: string;
  facilityId: string | null;     // Design Ref: §3.1.2
  facilityName: string | null;
  facilityType: string | null;
};

type WasteStats = {
  range: { from: string; to: string };
  total: number;
  daily: Array<{ date: string; weight: number }>;
  monthly: Array<{ ym: string; weight: number }>;
  byMaterial: Array<{ code: string; weight: number }>;
};
type IntakeStats = {
  range: { from: string; to: string };
  total: number;
  daily: Array<{ date: string; weight: number }>;
  monthly: Array<{ ym: string; weight: number }>;
  byCategory: Array<{ code: string; weight: number }>;
  byVehicle: Array<{ vehicleId: string; vehicleNo: string; count: number; weight: number }>;
};

export default function PerformanceClient({
  canEdit, vehicles,
}: {
  canEdit: boolean;
  vehicles: Array<{ id: string; vehicleNo: string; vehicleType: string }>;
}) {
  const [tab, setTab] = useState<'waste' | 'intake' | 'stats'>('waste');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">실적관리</h2>
        <span className="text-xs font-mono font-bold text-slate-600">생활폐기물 처리실적 + 자원순환센터 반입실적</span>
      </div>

      {/* 사용자 요청 2026-04-29: 탭 라벨 짧게 + 한 줄 (whitespace-nowrap) */}
      <div className="flex gap-1 border-b-2 border-line whitespace-nowrap overflow-x-auto">
        <TabButton active={tab === 'waste'} onClick={() => setTab('waste')}>처리입력</TabButton>
        <TabButton active={tab === 'intake'} onClick={() => setTab('intake')}>반입입력</TabButton>
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')}>실적통계</TabButton>
        <a href="/reports"
          className="ml-auto px-4 py-3 text-[0.8125rem] font-extrabold text-emerald-800 hover:text-emerald-900 hover:bg-emerald-50 transition flex items-center gap-1 whitespace-nowrap">
          보고서 →
        </a>
      </div>

      {tab === 'waste' && <WasteTab canEdit={canEdit} />}
      {tab === 'intake' && <IntakeTab canEdit={canEdit} vehicles={vehicles} />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-3 text-[0.9375rem] font-black tracking-tight border-b-[3px] -mb-0.5 transition ${
        active ? 'border-accent text-accent bg-accent-soft' : 'border-transparent text-slate-700 hover:text-ink hover:bg-slate-100'
      }`}>
      {children}
    </button>
  );
}

/* ────────────────  탭 1: 처리실적 입력  ──────────────── */
function WasteTab({ canEdit }: { canEdit: boolean }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<WasteRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; note: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const router = useRouter();

  function load() {
    const url = view === 'daily'
      ? `/api/waste-records?from=${date}&to=${date}`
      : `/api/waste-records?from=${date.slice(0, 7)}-01&to=${date.slice(0, 7)}-31`;
    fetch(url).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date, view]);

  /* 성상별 현재 입력값 표시 */
  const byMaterial = new Map<string, WasteRecord>();
  for (const r of items.filter((i) => i.recordDate === date)) byMaterial.set(r.materialCode, r);

  async function saveOne(materialCode: string) {
    const draft = drafts[materialCode] ?? { weight: '', note: '' };
    const w = Number(draft.weight);
    if (!Number.isFinite(w) || w < 0) { alert('실적(ton)은 0 이상 숫자'); return; }
    setSaving(materialCode);
    const res = await fetch('/api/waste-records', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordDate: date, materialCode, weightTon: w, note: draft.note || undefined }),
    });
    setSaving(null);
    if (res.ok) {
      setDrafts({ ...drafts, [materialCode]: { weight: '', note: '' } });
      load();
      router.refresh();
    } else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">기준일</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            aria-label="기준일"
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">조회</div>
          <div className="flex gap-1">
            <button onClick={() => setView('daily')}
              className={`px-3 py-1.5 rounded text-xs font-extrabold border-2 ${view === 'daily' ? 'bg-accent text-white border-accent' : 'bg-white border-line text-slate-600'}`}>
              일별
            </button>
            <button onClick={() => setView('monthly')}
              className={`px-3 py-1.5 rounded text-xs font-extrabold border-2 ${view === 'monthly' ? 'bg-accent text-white border-accent' : 'bg-white border-line text-slate-600'}`}>
              월별
            </button>
          </div>
        </div>
        <div className="ml-auto text-xs font-mono">
          {view === 'daily' ? date : date.slice(0, 7)} · 합계 <span className="font-extrabold text-accent">
            {items.filter((i) => view === 'daily' ? i.recordDate === date : i.recordDate.startsWith(date.slice(0, 7)))
              .reduce((s, i) => s + i.weightTon, 0).toFixed(3)}
          </span> ton
        </div>
      </div>

      {/* 입력 그리드 — 사용자 요청 2026-04-29 v2: 좁은 폰에서 저장 버튼이 viewport 밖으로 밀리는 문제 해결.
          - 입력 박스 w-24 → w-[68px] 축소 (000.000 7 chars 여전히 들어감)
          - 기록자 컬럼은 sm 이상에서만 노출 (모바일 숨김)
          - No 36px → 28px / 성상 80px → 56px / 입력 100px → 76px 컴팩트화
          - overflow-x-auto 유지 (혹시 더 좁은 폰 대비 안전망) */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase">
            <tr>
              <th className="px-1.5 py-2 text-center w-[28px]">No</th>
              <th className="px-1.5 py-2 text-left w-[56px]">성상</th>
              <th className="px-1.5 py-2 text-left w-[60px]">입력(t)</th>
              <th className="px-1.5 py-2 text-left hidden sm:table-cell">기록자</th>
              <th className="px-1.5 py-2 w-[56px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {WASTE_MATERIALS.map((m, idx) => {
              const cur = byMaterial.get(m.code);
              const draft = drafts[m.code] ?? { weight: '', note: '' };
              return (
                <tr key={m.code} className={cur ? 'bg-emerald-50/30' : ''}>
                  <td className="px-1.5 py-2 text-center font-mono font-extrabold text-slate-600">{idx + 1}</td>
                  <td className="px-1.5 py-2 font-extrabold text-ink whitespace-nowrap text-xs">{m.label}</td>
                  <td className="px-1.5 py-2">
                    <input type="number" step="0.001" value={draft.weight} disabled={!canEdit}
                      onChange={(e) => setDrafts({ ...drafts, [m.code]: { ...draft, weight: e.target.value } })}
                      placeholder={cur ? cur.weightTon.toFixed(3) : '0.000'}
                      className="w-[52px] px-1 py-1 rounded border border-line text-xs font-mono font-bold text-right disabled:bg-slate-50" />
                  </td>
                  <td className="px-1.5 py-2 text-[0.625rem] text-slate-600 whitespace-nowrap hidden sm:table-cell">
                    {cur ? `${cur.recorderName} (${cur.recorderRole})` : '—'}
                  </td>
                  <td className="px-1.5 py-2">
                    {canEdit && (
                      <button onClick={() => saveOne(m.code)} disabled={saving === m.code || !draft.weight}
                        className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-40">
                        {saving === m.code ? '저장…' : cur ? '갱신' : '등록'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {view === 'monthly' && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-xs font-extrabold text-ink">
            {date.slice(0, 7)} 월별 일자별 기록 ({items.length}건)
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-600">
              <tr>
                <th className="px-3 py-1.5 text-left">일자</th>
                <th className="px-3 py-1.5 text-left">성상</th>
                <th className="px-3 py-1.5 text-right">실적(ton)</th>
                <th className="px-3 py-1.5 text-left">기록자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono">{r.recordDate}</td>
                  <td className="px-3 py-1.5 font-bold">{MATERIAL_LABEL[r.materialCode] ?? r.materialCode}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold">{r.weightTon.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-xs">{r.recorderName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────  탭 2: 반입실적 입력  ──────────────── */
function IntakeTab({ canEdit, vehicles }: {
  canEdit: boolean;
  vehicles: Array<{ id: string; vehicleNo: string; vehicleType: string }>;
}) {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<IntakeRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<IntakeRecord | null>(null);
  const router = useRouter();

  function load() {
    fetch(`/api/recycling-intake?from=${from}&to=${to}`)
      .then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    const res = await fetch(`/api/recycling-intake/${id}`, { method: 'DELETE' });
    if (res.ok) { load(); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            aria-label="조회 시작일"
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            aria-label="조회 종료일"
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div className="text-xs font-mono ml-auto">
          {items.length}건 · 합계 <span className="font-extrabold text-accent">{items.reduce((s, i) => s + i.weightTon, 0).toFixed(3)}</span> ton
        </div>
        {/* Plan FR-08: 일자별 카드 PDF 출력 버튼 — from===to 일 때만 활성 (단일 일자 전제) */}
        {from === to && items.length > 0 && (
          <a
            href={`/api/reports/daily-treatment/pdf?date=${from}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700"
            title="해당 일자 일일 처리실적 일보 PDF 다운로드 (Module 6에서 활성화 예정)"
          >
            📄 일보 PDF 출력
          </a>
        )}
        {canEdit && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 rounded text-xs font-extrabold bg-accent text-white hover:bg-accent-strong">
            + 신규 등록
          </button>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-100 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">일자</th>
              <th className="px-3 py-2 text-left">반입시간</th>
              <th className="px-3 py-2 text-left">차량</th>
              <th className="px-3 py-2 text-left">처리시설</th>
              <th className="px-3 py-2 text-left">성상</th>
              <th className="px-3 py-2 text-right">반입량(ton)</th>
              <th className="px-3 py-2 text-left">비고</th>
              <th className="px-3 py-2 text-left">기록자</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">반입 기록이 없습니다.</td></tr>
            )}
            {items.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono">{i.intakeDate}</td>
                <td className="px-3 py-1.5 font-mono font-extrabold">{i.intakeTime}</td>
                <td className="px-3 py-1.5 font-bold">{i.vehicleNo}</td>
                <td className="px-3 py-1.5 text-xs">
                  {i.facilityName ?? <span className="text-slate-400 italic">(미지정)</span>}
                </td>
                <td className="px-3 py-1.5">
                  <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent">
                    {CATEGORY_LABEL[i.materialCategory] ?? i.materialCategory}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-extrabold">{i.weightTon.toFixed(3)}</td>
                <td className="px-3 py-1.5 text-xs max-w-[150px] truncate" title={i.note ?? ''}>{i.note ?? '—'}</td>
                <td className="px-3 py-1.5 text-[0.625rem]">{i.recorderName}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <button onClick={() => setEditTarget(i)} className="text-xs font-bold text-accent hover:underline mr-2">수정</button>
                      <button onClick={() => del(i.id)} className="text-xs font-bold text-red-600 hover:underline">삭제</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showCreate && canEdit && (
        <IntakeFormModal vehicles={vehicles} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); router.refresh(); }} />
      )}
      {editTarget && canEdit && (
        <IntakeFormModal vehicles={vehicles} initial={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); router.refresh(); }} />
      )}
    </div>
  );
}

function IntakeFormModal({ vehicles, initial, onClose, onSaved }: {
  vehicles: Array<{ id: string; vehicleNo: string; vehicleType: string }>;
  initial?: IntakeRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const [form, setForm] = useState({
    intakeDate: initial?.intakeDate ?? now.toISOString().slice(0, 10),
    intakeTime: initial?.intakeTime ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    vehicleId: initial?.vehicleId ?? (vehicles[0]?.id ?? ''),
    facilityId: initial?.facilityId ?? null,  // Design Ref: §3.1.2
    materialCategory: initial?.materialCategory ?? 'GENERAL',
    weightTon: initial ? String(initial.weightTon) : '',
    note: initial?.note ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    const w = Number(form.weightTon);
    if (!Number.isFinite(w) || w <= 0) { alert('반입량(ton)은 0 초과 숫자'); return; }
    if (!form.vehicleId) { alert('차량을 선택하세요'); return; }
    setSaving(true);
    const url = initial ? `/api/recycling-intake/${initial.id}` : '/api/recycling-intake';
    const method = initial ? 'PATCH' : 'POST';
    const body: Record<string, unknown> = {
      intakeDate: form.intakeDate, intakeTime: form.intakeTime,
      materialCategory: form.materialCategory, weightTon: w, note: form.note || undefined,
      facilityId: form.facilityId,  // null 허용
    };
    if (!initial) body.vehicleId = form.vehicleId;
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) onSaved();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line">
          <h3 className="font-extrabold text-ink">{initial ? '반입실적 수정' : '반입실적 신규 등록'}</h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">반입 일자</div>
            <input type="date" value={form.intakeDate} onChange={(e) => setForm({ ...form, intakeDate: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
          </div>
          <div>
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">반입 시간</div>
            <input type="time" value={form.intakeTime} onChange={(e) => setForm({ ...form, intakeTime: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
          </div>
          <div>
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">차량</div>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} disabled={!!initial}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold disabled:bg-slate-50">
              <option value="">— 차량 선택 —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo} ({v.vehicleType})</option>)}
            </select>
          </div>
          <div>
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">성상</div>
            <select value={form.materialCategory} onChange={(e) => setForm({ ...form, materialCategory: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold">
              {INTAKE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">반입량 (ton)</div>
            <input type="number" step="0.001" value={form.weightTon} onChange={(e) => setForm({ ...form, weightTon: e.target.value })}
              placeholder="0.000" className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
          </div>
          <div className="col-span-2">
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">처리시설 (Design §3.1.2)</div>
            <FacilitySelect
              value={form.facilityId}
              onChange={(id) => setForm({ ...form, facilityId: id })}
              className="w-full"
            />
          </div>
          <div className="col-span-2">
            <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">비고</div>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
          <button disabled={saving} onClick={submit}
            className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────  탭 3: 통계 / 출력  ──────────────── */
function StatsTab() {
  const ymStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const ymEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
  const [from, setFrom] = useState(ymStart);
  const [to, setTo] = useState(ymEnd);
  const [waste, setWaste] = useState<WasteStats | null>(null);
  const [intake, setIntake] = useState<IntakeStats | null>(null);

  async function load() {
    const [w, i] = await Promise.all([
      fetch(`/api/waste-records/stats?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/recycling-intake/stats?from=${from}&to=${to}`).then((r) => r.json()),
    ]);
    setWaste(w);
    setIntake(i);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function printNow() { if (typeof window !== 'undefined') window.print(); }

  const wasteMaxByMaterial = Math.max(1, ...(waste?.byMaterial ?? []).map((m) => m.weight));
  const intakeMaxByCategory = Math.max(1, ...(intake?.byCategory ?? []).map((m) => m.weight));
  const intakeMaxByVehicle = Math.max(1, ...(intake?.byVehicle ?? []).map((m) => m.weight));

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <button onClick={load}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">조회</button>
        <button onClick={printNow}
          className="ml-auto px-4 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          🖨 출력
        </button>
      </div>

      <div className="bg-white border-t-4 border-double border-slate-700 pt-4 px-3 print:px-0">
        <h2 className="text-2xl font-black text-center mb-1">실적 통계</h2>
        <div className="text-center text-sm font-bold text-slate-600 mb-5">{from} ~ {to}</div>

        {/* 사용자 요청 2026-04-29: H3 타이틀 1단계 업 (text-lg 18px → text-xl 20px),
            실적내용(KCard 값/라벨, sub-section 헤더, BarRow 라벨) 1단계 다운. */}
        {waste && (
          <section className="mb-6">
            <h3 className="font-extrabold text-ink text-xl mb-2 border-l-4 border-accent pl-2">📊 생활폐기물 처리실적</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <KCard label="총 처리량" value={`${waste.total.toFixed(3)} ton`} tone="accent" />
              <KCard label="기록 일수" value={`${waste.daily.length}일`} />
              <KCard label="성상 종류" value={`${waste.byMaterial.length}종`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-line rounded p-3">
                <div className="text-[0.6875rem] font-extrabold text-ink mb-2">성상별 분포</div>
                <div className="space-y-1">
                  {waste.byMaterial.sort((a, b) => b.weight - a.weight).map((m) => (
                    <BarRow key={m.code} label={MATERIAL_LABEL[m.code] ?? m.code} value={m.weight} max={wasteMaxByMaterial} suffix="t" />
                  ))}
                  {waste.byMaterial.length === 0 && <div className="text-[0.6875rem] text-slate-500 text-center py-3">데이터 없음</div>}
                </div>
              </div>
              <div className="bg-surface border border-line rounded p-3">
                <div className="text-[0.6875rem] font-extrabold text-ink mb-2">월별 추이</div>
                <div className="space-y-1">
                  {waste.monthly.sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => (
                    <BarRow key={m.ym} label={m.ym} value={m.weight}
                      max={Math.max(1, ...waste.monthly.map((x) => x.weight))} suffix="t" color="bg-amber-400" />
                  ))}
                  {waste.monthly.length === 0 && <div className="text-[0.6875rem] text-slate-500 text-center py-3">데이터 없음</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        {intake && (
          <section className="mb-6">
            <h3 className="font-extrabold text-ink text-xl mb-2 border-l-4 border-emerald-500 pl-2">🚚 자원순환센터 반입실적</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <KCard label="총 반입량" value={`${intake.total.toFixed(3)} ton`} tone="success" />
              <KCard label="반입 차량" value={`${intake.byVehicle.length}대`} />
              <KCard label="반입 일수" value={`${intake.daily.length}일`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-line rounded p-3">
                <div className="text-[0.6875rem] font-extrabold text-ink mb-2">성상별 (4종)</div>
                <div className="space-y-1">
                  {intake.byCategory.sort((a, b) => b.weight - a.weight).map((m) => (
                    <BarRow key={m.code} label={CATEGORY_LABEL[m.code] ?? m.code} value={m.weight} max={intakeMaxByCategory} suffix="t" color="bg-emerald-500" />
                  ))}
                  {intake.byCategory.length === 0 && <div className="text-[0.6875rem] text-slate-500 text-center py-3">데이터 없음</div>}
                </div>
              </div>
              <div className="bg-surface border border-line rounded p-3">
                <div className="text-[0.6875rem] font-extrabold text-ink mb-2">차량별 Top</div>
                <div className="space-y-1">
                  {intake.byVehicle.sort((a, b) => b.weight - a.weight).slice(0, 10).map((v) => (
                    <BarRow key={v.vehicleId} label={`${v.vehicleNo} (${v.count}회)`} value={v.weight} max={intakeMaxByVehicle} suffix="t" color="bg-blue-400" />
                  ))}
                  {intake.byVehicle.length === 0 && <div className="text-[0.6875rem] text-slate-500 text-center py-3">데이터 없음</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="text-[0.625rem] font-mono text-slate-600 text-right mt-4">
          출력일시: {new Date().toLocaleString('ko-KR')}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}

function KCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'success' }) {
  /* 사용자 요청 2026-04-29: 실적내용 1단계 다운 — label 11→10px, value 2xl→xl */
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    accent: 'bg-accent-soft border-accent text-accent',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  };
  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${c[tone]} shadow-sm`}>
      <div className="text-[0.625rem] font-mono font-extrabold uppercase">{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}

function BarRow({ label, value, max, suffix, color = 'bg-accent' }: { label: string; value: number; max: number; suffix: string; color?: string }) {
  /* 사용자 요청 2026-04-29: BarRow 라벨 1단계 다운 — text-xs(12px) → text-[0.6875rem] */
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[90px] text-[0.6875rem] font-bold text-ink truncate">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-sm h-5 overflow-hidden">
        <div className={`h-full ${color} flex items-center justify-end pr-1.5 text-[0.625rem] font-mono font-extrabold text-white`} style={{ width: `${Math.max(2, pct)}%` }}>
          {value.toFixed(2)}{suffix}
        </div>
      </div>
    </div>
  );
}
