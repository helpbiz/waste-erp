'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const BAG_MACHINE_LABEL: Record<string, string> = {
  food_1L: '음식물 1L', food_2L: '음식물 2L', food_3L: '음식물 3L', food_5L: '음식물 5L', food_10L: '음식물 10L',
  living_5L: '생활 5L', living_10L: '생활 10L', living_20L: '생활 20L', living_30L: '생활 30L',
  living_50L: '생활 50L', living_75L: '생활 75L',
  reuse_10L: '재사용 10L', reuse_20L: '재사용 20L',
  illegal_20: '불법투기 20L', special: '특수', deadAnimal: '동물사체',
};
const LARGE_WASTE_LABEL: Record<string, string> = {
  furniture: '가구류', chair: '의자', sofa: '소파', bed: '침대', appliance: '가전',
  extinguisher: '소화기', household: '생활용품', other: '기타', illegalTotal: '불법투기',
};

/* ─── 타입 ─── */

type Vehicle = {
  id: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleTon: string | null;
  fuelType: string;
  totalMileage: number | null;
};

type Coworker = { id: string; name: string };
type DisposalSite = { id: string; name: string };

const INSPECTION_ITEMS = [
  { key: 'safetyBar',    label: '안전멈춤Bar',       opts: ['양호', '이상', '수리점검'] },
  { key: 'handSwitch',   label: '양손조작안전스위치',  opts: ['양호', '이상', '수리점검'] },
  { key: 'dashcam',      label: '블랙박스',           opts: ['양호', '이상', '수리점검'] },
  { key: 'turnSignal',   label: '방향지시등',         opts: ['양호', '이상', '수리점검'] },
  { key: 'engineOil',    label: '엔진오일',           opts: ['양호', '이상', '수리점검'] },
  { key: 'lubricant',    label: '윤활제',             opts: ['양호', '이상', '수리점검'] },
  { key: 'brake',        label: '브레이크',           opts: ['양호', '이상', '수리점검'] },
  { key: 'tire',         label: '타이어',             opts: ['양호', '이상', '수리점검'] },
  { key: 'headlight',    label: '전조등',             opts: ['양호', '이상', '수리점검'] },
  { key: 'carWash',      label: '세차여부',           opts: ['예', '아니오'] },
] as const;

type InspectionKey = typeof INSPECTION_ITEMS[number]['key'];

/* ─── 작업내역 타입 ─── */

type BagWorkRow = {
  general: string;
  food: string;
  recycle: string;
  disposalSite: string; /* 수기 입력 또는 드롭다운 선택 — 자유 텍스트 */
  note: string; /* 비고 */
};

type BagMachineWork = {
  food_1L: string; food_2L: string; food_3L: string; food_5L: string; food_10L: string;
  living_5L: string; living_10L: string; living_20L: string; living_30L: string; living_50L: string; living_75L: string;
  reuse_10L: string; reuse_20L: string;
  illegal_20: string;
  special: string;
  deadAnimal: string;
};

type LargeWasteWork = {
  furniture: string; chair: string; sofa: string; bed: string; appliance: string;
  extinguisher: string; household: string; other: string; illegalTotal: string;
};

type OperationRow = { startTime: string; endTime: string; zone: string; note: string };

type FormState = {
  logDate: string;
  prevMileage: string;
  todayMileage: string;
  operationRows: OperationRow[];
  fuelUsed: string;
  ureaUsed: string;
  ureaCost: string;
  bagWork: BagWorkRow[];
  bagMachineWork: BagMachineWork;
  largeWasteWork: LargeWasteWork;
  inspection: Record<InspectionKey, string>;
  maintCompany: string;
  maintContent: string;
  maintCost: string;
  receiptPhoto: string;
  note: string;
};

function defaultForm(lastEndMileage: number | null): FormState {
  const today = new Date().toISOString().slice(0, 10);
  const defaultInspection = Object.fromEntries(
    INSPECTION_ITEMS.map((i) => [i.key, i.opts[0]])
  ) as Record<InspectionKey, string>;
  const emptyBagRow = (): BagWorkRow => ({ general: '', food: '', recycle: '', disposalSite: '', note: '' });
  return {
    logDate: today,
    prevMileage: lastEndMileage != null ? String(lastEndMileage) : '',
    todayMileage: '',
    operationRows: Array.from({ length: 4 }, () => ({ startTime: '', endTime: '', zone: '', note: '' })),
    fuelUsed: '',
    ureaUsed: '',
    ureaCost: '',
    bagWork: [emptyBagRow(), emptyBagRow(), emptyBagRow(), emptyBagRow()],
    bagMachineWork: {
      food_1L: '', food_2L: '', food_3L: '', food_5L: '', food_10L: '',
      living_5L: '', living_10L: '', living_20L: '', living_30L: '', living_50L: '', living_75L: '',
      reuse_10L: '', reuse_20L: '',
      illegal_20: '', special: '', deadAnimal: '',
    },
    largeWasteWork: {
      furniture: '', chair: '', sofa: '', bed: '', appliance: '',
      extinguisher: '', household: '', other: '', illegalTotal: '',
    },
    inspection: defaultInspection,
    maintCompany: '',
    maintContent: '',
    maintCost: '',
    receiptPhoto: '',
    note: '',
  };
}

/* ─── Props ─── */

type Props = {
  vehicles: Vehicle[];
  coworkers: Coworker[];
  disposalSites: DisposalSite[];
  defaultVehicleId: string | null;
  driverName: string;
  lastEndMileage: number | null;
  showFuel: boolean;
  showUrea: boolean;
};

/* ─── 메인 컴포넌트 ─── */

export default function VehicleLogClient({
  vehicles, coworkers, disposalSites, defaultVehicleId, driverName, lastEndMileage, showFuel, showUrea,
}: Props) {
  const [tab, setTab] = useState<'write' | 'history'>('write');
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? '');
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const [showPassengerPicker, setShowPassengerPicker] = useState(false);
  const [form, setForm] = useState<FormState>(() => defaultForm(lastEndMileage));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function setInspection(key: InspectionKey, value: string) {
    setForm((p) => ({ ...p, inspection: { ...p.inspection, [key]: value } }));
  }

  function setBagWorkRow(idx: number, field: keyof BagWorkRow, value: string) {
    setForm((p) => {
      const next = [...p.bagWork] as BagWorkRow[];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, bagWork: next };
    });
  }

  function setBagMachine(field: keyof BagMachineWork, value: string) {
    setForm((p) => ({ ...p, bagMachineWork: { ...p.bagMachineWork, [field]: value } }));
  }

  function setLargeWaste(field: keyof LargeWasteWork, value: string) {
    setForm((p) => ({ ...p, largeWasteWork: { ...p.largeWasteWork, [field]: value } }));
  }

  function setOperationRow(idx: number, field: keyof OperationRow, value: string) {
    setForm((p) => {
      const rows = p.operationRows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      return { ...p, operationRows: rows };
    });
  }

  function togglePassenger(id: string) {
    setSelectedPassengerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedPassengerNames = coworkers
    .filter((w) => selectedPassengerIds.includes(w.id))
    .map((w) => w.name);

  function openPreview() {
    if (!vehicleId) { alert('차량을 선택해 주세요.'); return; }
    if (!form.todayMileage) { alert('금일누적거리를 입력해 주세요.'); return; }
    setShowPreview(true);
  }

  async function submit() {
    setShowPreview(false);

    setSubmitting(true);
    setResult(null);

    const routeDetail = JSON.stringify({
      passengers: selectedPassengerNames.join(', '),
      operationRows: form.operationRows.filter((r) => r.startTime || r.endTime || r.zone || r.note),
      ...(showUrea && { ureaUsed: Number(form.ureaUsed) || 0, ureaCost: Number(form.ureaCost) || 0 }),
      bagWork: form.bagWork.map((row) => ({
        general: Number(row.general) || 0,
        food: Number(row.food) || 0,
        recycle: Number(row.recycle) || 0,
        disposalSite: row.disposalSite.trim() || null,
        note: row.note.trim() || null,
      })),
      bagMachineWork: Object.fromEntries(
        Object.entries(form.bagMachineWork).map(([k, v]) => [k, Number(v) || 0])
      ),
      largeWasteWork: Object.fromEntries(
        Object.entries(form.largeWasteWork).map(([k, v]) => [k, Number(v) || 0])
      ),
      inspection: form.inspection,
      maintenance: {
        company: form.maintCompany,
        content: form.maintContent,
        cost: Number(form.maintCost) || 0,
        receiptPhoto: form.receiptPhoto || null,
      },
      note: form.note,
    });

    try {
      const createRes = await fetch('/api/vehicle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          startMileage: Number(form.prevMileage) || undefined,
          endMileage: Number(form.todayMileage),
          fuelUsed: form.fuelUsed.trim() !== '' ? Number(form.fuelUsed) : undefined,
          routeDetail,
        }),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        setResult({ ok: false, message: translateVehicleLogError(d.error) ?? d.error ?? '저장 실패' });
        return;
      }
      const { log } = await createRes.json();

      const submitRes = await fetch(`/api/vehicle-logs/${log.id}/submit`, { method: 'POST' });
      if (!submitRes.ok) {
        const d = await submitRes.json().catch(() => ({}));
        setResult({ ok: false, message: translateVehicleLogError(d.error) ?? d.error ?? '제출 실패' });
        return;
      }

      setResult({ ok: true, message: '차량일지가 제출되었습니다.' });
      setForm(defaultForm(Number(form.todayMileage)));
      setSelectedPassengerIds([]);
    } catch {
      setResult({ ok: false, message: '네트워크 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="text-4xl mb-3">🚛</div>
        <div className="text-sm font-bold text-ink-muted">등록된 차량이 없습니다.</div>
        <div className="text-xs text-ink-faint mt-1">관리자에게 차량 등록을 요청하세요.</div>
        <Link href="/worker" className="mt-4 inline-block text-accent text-sm font-bold">← 홈으로</Link>
      </div>
    );
  }

  /* 작업내역 A 합계 */
  const bagTotals = {
    general: form.bagWork.reduce((s, r) => s + (Number(r.general) || 0), 0),
    food:    form.bagWork.reduce((s, r) => s + (Number(r.food) || 0), 0),
    recycle: form.bagWork.reduce((s, r) => s + (Number(r.recycle) || 0), 0),
  };

  return (
    <div className="pb-36">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">차량일지</h1>
      </div>

      {/* 탭 — 작성 / 내역 확인 */}
      <div className="px-4 pb-3">
        <div className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card">
          <button onClick={() => setTab('write')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-extrabold transition ${tab === 'write' ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'}`}>
            ✏ 작성
          </button>
          <button onClick={() => setTab('history')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-extrabold transition ${tab === 'history' ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'}`}>
            📋 내역 확인
          </button>
        </div>
      </div>

      {tab === 'history' && <HistoryPanel />}

      {tab === 'write' && <>

      {/* 차량 선택 */}
      <div className="mx-4 mb-3 bg-surface border-2 border-accent rounded-xl p-3">
        <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-1.5 tracking-wider">선택 차량</div>
        {selectedVehicle ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-base font-black text-ink">{selectedVehicle.vehicleNo}</div>
              <div className="text-xs font-mono text-ink-muted mt-0.5">
                {selectedVehicle.vehicleType} {selectedVehicle.vehicleTon && `· ${selectedVehicle.vehicleTon}t`} · {selectedVehicle.fuelType}
              </div>
            </div>
            <button type="button" onClick={() => setShowVehiclePicker(true)}
              className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-extrabold border border-accent/30 active:scale-95">
              차량 변경
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowVehiclePicker(true)}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-accent text-accent text-sm font-bold">
            차량 선택
          </button>
        )}
      </div>

      {/* 차량 선택 바텀시트 */}
      {showVehiclePicker && (
        <BottomSheet title="차량 선택" onClose={() => setShowVehiclePicker(false)}>
          {vehicles.map((v) => (
            <button key={v.id} type="button"
              onClick={() => { setVehicleId(v.id); setShowVehiclePicker(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition active:scale-[0.99] ${
                vehicleId === v.id ? 'border-accent bg-accent/5' : 'border-line bg-surface'
              }`}>
              <div className="font-extrabold text-sm text-ink">{v.vehicleNo}</div>
              <div className="text-xs font-mono text-ink-muted mt-0.5">
                {v.vehicleType} {v.vehicleTon && `${v.vehicleTon}t`} · {v.fuelType}
                {v.totalMileage != null && ` · 누적 ${v.totalMileage.toLocaleString()}km`}
              </div>
            </button>
          ))}
        </BottomSheet>
      )}

      {/* 동승자 선택 바텀시트 */}
      {showPassengerPicker && (
        <BottomSheet title="동승자 선택" onClose={() => setShowPassengerPicker(false)}>
          {coworkers.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-muted">등록된 동료 직원이 없습니다.</div>
          ) : (
            coworkers.map((w) => {
              const checked = selectedPassengerIds.includes(w.id);
              return (
                <button key={w.id} type="button" onClick={() => togglePassenger(w.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition active:scale-[0.99] ${
                    checked ? 'border-accent bg-accent/5' : 'border-line bg-surface'
                  }`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    checked ? 'bg-accent border-accent' : 'border-line'
                  }`}>
                    {checked && (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-extrabold ${checked ? 'text-accent' : 'text-ink'}`}>{w.name}</span>
                </button>
              );
            })
          )}
          <button type="button" onClick={() => setShowPassengerPicker(false)}
            className="w-full mt-2 py-3 rounded-xl bg-accent text-white font-extrabold text-sm active:scale-[0.99]">
            확인 ({selectedPassengerIds.length}명 선택)
          </button>
        </BottomSheet>
      )}

      <div className="px-4 space-y-3">
        {/* ── Card 1: 기본정보 ── */}
        <Card title="기본정보">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="작성일자">
                <input type="date" value={form.logDate}
                  onChange={(e) => setField('logDate', e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="작성자">
                <div className={`${INPUT_CLS} bg-surface-soft text-ink-muted`}>{driverName}</div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="전일누적거리 (km)">
                <input type="number" inputMode="numeric" value={form.prevMileage}
                  onChange={(e) => setField('prevMileage', e.target.value)}
                  placeholder="0" className={INPUT_CLS} />
              </Field>
              <Field label="금일누적거리 (km)">
                <input type="number" inputMode="numeric" value={form.todayMileage}
                  onChange={(e) => setField('todayMileage', e.target.value)}
                  placeholder="0" className={INPUT_CLS} />
              </Field>
            </div>
            {form.prevMileage && form.todayMileage && Number(form.todayMileage) >= Number(form.prevMileage) && (
              <div className="bg-accent/10 rounded-lg px-3 py-2 text-xs font-mono font-bold text-accent">
                금일 운행거리: {(Number(form.todayMileage) - Number(form.prevMileage)).toLocaleString()} km
              </div>
            )}
            {form.prevMileage && form.todayMileage && Number(form.todayMileage) < Number(form.prevMileage) && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold text-amber-800">
                ⚠ 금일누적거리가 전일보다 작습니다. 계기판 리셋 또는 차량 변경 시 그대로 입력하세요.
              </div>
            )}

            <Field label="동승자">
              <button type="button" onClick={() => setShowPassengerPicker(true)}
                className={`${INPUT_CLS} text-left flex items-center justify-between gap-2 min-h-[44px]`}>
                {selectedPassengerNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedPassengerNames.map((name) => (
                      <span key={name} className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[0.6875rem] font-extrabold border border-accent/30">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-ink-muted text-sm">동승자 선택</span>
                )}
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0 text-ink-muted">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </Field>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono font-extrabold text-slate-600">차량운행내역 (4차)</span>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs border-collapse min-w-[420px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-1 py-1 font-bold text-center w-8">차수</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-center w-[90px]">시작시간</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-center w-[90px]">종료시간</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-center">작업구간</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-center w-[80px]">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.operationRows.map((row, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-1 py-0.5 text-center font-bold">{i + 1}차</td>
                        <td className="border border-slate-300 p-0.5">
                          <input type="time" value={row.startTime}
                            onChange={(e) => setOperationRow(i, 'startTime', e.target.value)}
                            className="w-full px-1 py-1 text-xs font-mono border-0 focus:outline-none bg-transparent" />
                        </td>
                        <td className="border border-slate-300 p-0.5">
                          <input type="time" value={row.endTime}
                            onChange={(e) => setOperationRow(i, 'endTime', e.target.value)}
                            className="w-full px-1 py-1 text-xs font-mono border-0 focus:outline-none bg-transparent" />
                        </td>
                        <td className="border border-slate-300 p-0.5">
                          <input type="text" value={row.zone}
                            onChange={(e) => setOperationRow(i, 'zone', e.target.value)}
                            placeholder="구간/경로"
                            className="w-full px-1 py-1 text-xs border-0 focus:outline-none bg-transparent" />
                        </td>
                        <td className="border border-slate-300 p-0.5">
                          <input type="text" value={row.note}
                            onChange={(e) => setOperationRow(i, 'note', e.target.value)}
                            className="w-full px-1 py-1 text-xs border-0 focus:outline-none bg-transparent" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Card 2: 주유 (업체 기능 플래그로 표시 여부 결정) ── */}
        {showFuel && (
          <Card title={showUrea ? '주유 / 요소수' : '주유'}>
            <div className="space-y-3">
              {selectedVehicle && (
                <div className="bg-surface-soft rounded-lg px-3 py-2 text-xs font-mono text-ink-muted">
                  유종: <span className="text-ink font-bold">{selectedVehicle.fuelType === 'DIESEL' ? '경유' : selectedVehicle.fuelType === 'LPG' ? 'LPG' : selectedVehicle.fuelType === 'ELECTRIC' ? '전기' : selectedVehicle.fuelType === 'CNG' ? 'CNG' : selectedVehicle.fuelType === 'GASOLINE' ? '휘발유' : selectedVehicle.fuelType}</span>
                </div>
              )}
              <Field label="주유량 (ℓ)">
                <input type="number" inputMode="decimal" step="0.1" min="0"
                  value={form.fuelUsed} onChange={(e) => setField('fuelUsed', e.target.value)}
                  placeholder="0.0" className={INPUT_CLS} />
              </Field>
              {showUrea && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
                  <Field label="요소수 (ℓ)">
                    <input type="number" inputMode="decimal" step="0.1" min="0"
                      value={form.ureaUsed} onChange={(e) => setField('ureaUsed', e.target.value)}
                      placeholder="0.0" className={INPUT_CLS} />
                  </Field>
                  <Field label="요소수금액 (원)">
                    <input type="number" inputMode="numeric" min="0"
                      value={form.ureaCost} onChange={(e) => setField('ureaCost', e.target.value)}
                      placeholder="0" className={INPUT_CLS} />
                  </Field>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Card A: 작업내역 — 중량제봉투 및 음식물용기, 재활용·자원 ── */}
        <Card title="작업내역 — 중량제봉투 및 음식물용기, 재활용·자원 (단위: kg)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[340px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center w-10">차수</th>
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center">일반(kg)</th>
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center">음식물(kg)</th>
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center">재활용·자원(kg)</th>
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center min-w-[90px]">반입장소</th>
                  <th className="px-2 py-1.5 border border-line font-extrabold text-center min-w-[80px]">비고</th>
                </tr>
              </thead>
              <tbody>
                {([0, 1, 2, 3] as const).map((idx) => (
                  <tr key={idx} className="even:bg-slate-50">
                    <td className="px-2 py-1.5 border border-line text-center font-extrabold text-ink-muted">
                      {idx + 1}차
                    </td>
                    <td className="px-1 py-1 border border-line">
                      <input type="number" inputMode="numeric" min="0" placeholder="0"
                        value={form.bagWork[idx].general}
                        onChange={(e) => setBagWorkRow(idx, 'general', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-line text-center text-sm font-mono focus:outline-none focus:border-accent bg-white" />
                    </td>
                    <td className="px-1 py-1 border border-line">
                      <input type="number" inputMode="numeric" min="0" placeholder="0"
                        value={form.bagWork[idx].food}
                        onChange={(e) => setBagWorkRow(idx, 'food', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-line text-center text-sm font-mono focus:outline-none focus:border-accent bg-white" />
                    </td>
                    <td className="px-1 py-1 border border-line">
                      <input type="number" inputMode="numeric" min="0" placeholder="0"
                        value={form.bagWork[idx].recycle}
                        onChange={(e) => setBagWorkRow(idx, 'recycle', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-line text-center text-sm font-mono focus:outline-none focus:border-accent bg-white" />
                    </td>
                    <td className="px-1 py-1 border border-line">
                      <input
                        type="text"
                        list="disposal-sites-list"
                        value={form.bagWork[idx].disposalSite}
                        onChange={(e) => setBagWorkRow(idx, 'disposalSite', e.target.value)}
                        placeholder="직접 입력"
                        className="w-full px-2 py-1 rounded border border-line text-xs font-bold focus:outline-none focus:border-accent bg-white min-w-[72px]"
                      />
                    </td>
                    <td className="px-1 py-1 border border-line">
                      <input
                        type="text"
                        value={form.bagWork[idx].note}
                        onChange={(e) => setBagWorkRow(idx, 'note', e.target.value)}
                        placeholder="비고"
                        className="w-full px-2 py-1 rounded border border-line text-xs font-bold focus:outline-none focus:border-accent bg-white min-w-[64px]"
                      />
                    </td>
                  </tr>
                ))}
                {/* 합계행 */}
                <tr className="bg-accent/10 font-extrabold">
                  <td className="px-2 py-1.5 border border-line text-center text-xs text-accent">계</td>
                  <td className="px-2 py-1.5 border border-line text-center text-xs font-mono text-accent">
                    {bagTotals.general > 0 ? bagTotals.general : '—'}
                  </td>
                  <td className="px-2 py-1.5 border border-line text-center text-xs font-mono text-accent">
                    {bagTotals.food > 0 ? bagTotals.food : '—'}
                  </td>
                  <td className="px-2 py-1.5 border border-line text-center text-xs font-mono text-accent">
                    {bagTotals.recycle > 0 ? bagTotals.recycle : '—'}
                  </td>
                  <td className="border border-line" />
                <td className="border border-line" />
                </tr>
              </tbody>
            </table>
          </div>
          {/* 반입장소 자동완성 — 관리자 등록 목록을 datalist로 제공, 수기 입력 가능 */}
          <datalist id="disposal-sites-list">
            {disposalSites.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <p className="mt-2 text-[0.625rem] text-ink-muted">
            ※ 매회 처리 시 처리장 계근전표 기준으로 작성. 목록에 없으면 직접 입력하세요.
          </p>
        </Card>

        {/* ── Card B: 작업내역 — 종량제 및 봉투 수거량 기재 ── */}
        <Card title="작업내역 — 종량제 및 봉투 수거량 기재 (단위: L)">
          <div className="space-y-3">
            {/* 음식물 종량제 */}
            <div>
              <div className="text-[0.6875rem] font-extrabold text-ink mb-1.5">음식물 종량제</div>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      {['1L','2L','3L','5L','10L'].map((l) => (
                        <th key={l} className="px-3 py-1.5 border border-line font-extrabold text-center min-w-[52px]">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(['food_1L','food_2L','food_3L','food_5L','food_10L'] as const).map((k) => (
                        <td key={k} className="px-1 py-1 border border-line">
                          <input type="number" inputMode="numeric" min="0" placeholder="0"
                            value={form.bagMachineWork[k]}
                            onChange={(e) => setBagMachine(k, e.target.value)}
                            className="w-full px-1 py-1 rounded border border-line text-center text-sm font-mono focus:outline-none focus:border-accent bg-white min-w-[44px]" />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 생활폐기물 종량제 */}
            <div>
              <div className="text-[0.6875rem] font-extrabold text-ink mb-1.5">생활폐기물 종량제</div>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      {['5L','10L','20L','30L','50L','75L'].map((l) => (
                        <th key={l} className="px-3 py-1.5 border border-line font-extrabold text-center min-w-[52px]">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(['living_5L','living_10L','living_20L','living_30L','living_50L','living_75L'] as const).map((k) => (
                        <td key={k} className="px-1 py-1 border border-line">
                          <input type="number" inputMode="numeric" min="0" placeholder="0"
                            value={form.bagMachineWork[k]}
                            onChange={(e) => setBagMachine(k, e.target.value)}
                            className="w-full px-1 py-1 rounded border border-line text-center text-sm font-mono focus:outline-none focus:border-accent bg-white min-w-[44px]" />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 재사용 / 무단투기 / 비고 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[0.6875rem] font-extrabold text-ink mb-1.5">재사용</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['reuse_10L','reuse_20L'] as const).map((k, i) => (
                    <Field key={k} label={i === 0 ? '10L' : '20L'}>
                      <input type="number" inputMode="numeric" min="0" placeholder="0"
                        value={form.bagMachineWork[k]}
                        onChange={(e) => setBagMachine(k, e.target.value)}
                        className={INPUT_CLS} />
                    </Field>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[0.6875rem] font-extrabold text-ink mb-1.5">무단투기</div>
                <Field label="20기준">
                  <input type="number" inputMode="numeric" min="0" placeholder="0"
                    value={form.bagMachineWork.illegal_20}
                    onChange={(e) => setBagMachine('illegal_20', e.target.value)}
                    className={INPUT_CLS} />
                </Field>
              </div>
            </div>

            <div>
              <div className="text-[0.6875rem] font-extrabold text-ink mb-1.5">비고</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="특수">
                  <input type="number" inputMode="numeric" min="0" placeholder="0"
                    value={form.bagMachineWork.special}
                    onChange={(e) => setBagMachine('special', e.target.value)}
                    className={INPUT_CLS} />
                </Field>
                <Field label="동물사채(마대)">
                  <input type="number" inputMode="numeric" min="0" placeholder="0"
                    value={form.bagMachineWork.deadAnimal}
                    onChange={(e) => setBagMachine('deadAnimal', e.target.value)}
                    className={INPUT_CLS} />
                </Field>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Card C: 작업내역 — 대형폐기물 ── */}
        <Card title="작업내역 — 대형폐기물 (단위: 점)">
          <div className="grid grid-cols-4 gap-2">
            {([
              ['furniture', '가구류'], ['chair', '의자류'], ['sofa', '쇼파류'], ['bed', '침대류'],
              ['appliance', '가전제품'], ['extinguisher', '소화기'], ['household', '생활용품'], ['other', '기타'],
            ] as const).map(([k, label]) => (
              <Field key={k} label={label}>
                <input type="number" inputMode="numeric" min="0" placeholder="0"
                  value={form.largeWasteWork[k]}
                  onChange={(e) => setLargeWaste(k, e.target.value)}
                  className={INPUT_CLS} />
              </Field>
            ))}
          </div>
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2.5 flex items-center gap-2 border border-line">
            <span className="text-xs font-extrabold text-ink flex-1">무단투기물 수거량 총합 (가구류 기준)</span>
            <input type="number" inputMode="numeric" min="0" placeholder="0"
              value={form.largeWasteWork.illegalTotal}
              onChange={(e) => setLargeWaste('illegalTotal', e.target.value)}
              className="w-20 px-2 py-1 rounded border-2 border-line text-center text-sm font-mono font-bold focus:outline-none focus:border-accent bg-white" />
            <span className="text-xs font-bold text-ink-muted">점</span>
          </div>
        </Card>

        {/* ── Card 4: 차량점검 ── */}
        <Card title="차량점검">
          <div className="space-y-2">
            {INSPECTION_ITEMS.map((item) => {
              const val = form.inspection[item.key];
              const isAbnormal = val === '이상' || val === '수리점검' || val === '아니오';
              return (
                <div key={item.key} className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition ${
                  isAbnormal ? 'bg-amber-50 border-amber-300' : 'bg-surface border-line'
                }`}>
                  <span className={`flex-1 text-xs font-extrabold ${isAbnormal ? 'text-amber-800' : 'text-ink'}`}>
                    {item.label}
                  </span>
                  <div className="flex gap-1">
                    {item.opts.map((opt) => (
                      <button key={opt} type="button" onClick={() => setInspection(item.key, opt)}
                        className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-extrabold transition active:scale-95 border ${
                          val === opt
                            ? opt === '양호' || opt === '예'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : opt === '이상' || opt === '아니오'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-red-600 text-white border-red-600'
                            : 'bg-surface text-ink-muted border-line hover:bg-surface-soft'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {INSPECTION_ITEMS.some((i) => form.inspection[i.key] !== i.opts[0]) && (
            <div className="mt-2.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold text-amber-800">
              ⚠️ 이상 항목: {INSPECTION_ITEMS.filter((i) => form.inspection[i.key] !== i.opts[0]).map((i) => `${i.label}(${form.inspection[i.key]})`).join(', ')}
            </div>
          )}
        </Card>

        {/* ── Card 5: 차량정비이력 ── */}
        <Card title="차량정비이력">
          <div className="space-y-3">
            <Field label="정비업체">
              <input type="text" list="maint-company-list"
                value={form.maintCompany} onChange={(e) => setField('maintCompany', e.target.value)}
                placeholder="정비업체명 입력" className={INPUT_CLS} />
              <datalist id="maint-company-list">
                <option value="현대자동차 서비스" />
                <option value="기아자동차 서비스" />
                <option value="자동차 정비소" />
                <option value="타이어 전문점" />
                <option value="엔진오일 교환소" />
                <option value="기타" />
              </datalist>
            </Field>
            <Field label="정비내용">
              <textarea value={form.maintContent} onChange={(e) => setField('maintContent', e.target.value)}
                placeholder="예: 엔진오일 교환, 타이어 교체 등" rows={2}
                className={`${INPUT_CLS} resize-none`} />
            </Field>
            <Field label="수리비용 (원)">
              <input type="number" inputMode="numeric" min="0"
                value={form.maintCost} onChange={(e) => setField('maintCost', e.target.value)}
                placeholder="0" className={INPUT_CLS} />
            </Field>

            <Field label="영수증(거래명세표)">
              <div className="space-y-2">
                {form.receiptPhoto ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.receiptPhoto} alt="영수증" className="w-full rounded-lg border border-line object-cover max-h-48" />
                    <button type="button" onClick={() => setField('receiptPhoto', '')}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center font-bold active:scale-95">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => receiptInputRef.current?.click()}
                    className="w-full py-4 rounded-lg border-2 border-dashed border-line bg-surface-soft flex flex-col items-center gap-1.5 active:scale-[0.99] text-ink-muted">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-bold">영수증 촬영</span>
                  </button>
                )}
                <input ref={receiptInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try { setField('receiptPhoto', await handleReceiptPhoto(file)); }
                    catch { /* 무시 */ }
                    e.target.value = '';
                  }} />
              </div>
            </Field>
          </div>
        </Card>

        {/* ── 특이사항 ── */}
        <Card title="특이사항">
          <textarea value={form.note} onChange={(e) => setField('note', e.target.value)}
            placeholder="운행 중 발생한 특이사항을 입력하세요."
            rows={3} className={`${INPUT_CLS} resize-none`} />
        </Card>

        {/* 결과 메시지 */}
        {result && (
          <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${
            result.ok ? 'bg-green-50 text-success border-green-300' : 'bg-red-50 text-danger border-red-300'
          }`}>
            {result.ok ? '✓ ' : '✕ '}{result.message}
            {result.ok && (
              <Link href="/worker" className="block mt-2 text-accent font-extrabold text-xs">← 홈으로 돌아가기</Link>
            )}
          </div>
        )}
      </div>

      {/* Sticky 미리보기 버튼 */}
      {!result?.ok && (
        <div className="fixed left-0 right-0 z-40 bg-surface border-t border-line px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={openPreview}
            disabled={submitting || !vehicleId || !form.todayMileage}
            className="w-full py-3.5 rounded-xl bg-accent text-white text-base font-black shadow-card active:scale-[0.99] disabled:opacity-50 transition">
            {submitting ? '제출 중…' : '📋 미리보기 후 제출'}
          </button>
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreview && (
        <VehicleLogPreview
          form={form}
          vehicle={selectedVehicle ?? null}
          passengerNames={selectedPassengerNames}
          driverName={driverName}
          onConfirm={submit}
          onCancel={() => setShowPreview(false)}
          submitting={submitting}
        />
      )}

      </>}
    </div>
  );
}

/* ─── 미리보기 모달 ─── */

function VehicleLogPreview({
  form, vehicle, passengerNames, driverName, onConfirm, onCancel, submitting,
}: {
  form: FormState;
  vehicle: { vehicleNo: string; vehicleType: string; vehicleTon: string | null } | null;
  passengerNames: string[];
  driverName: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const dist = form.prevMileage && form.todayMileage
    ? (Number(form.todayMileage) - Number(form.prevMileage)).toLocaleString()
    : null;

  const filledOps = form.operationRows.filter((r) => r.startTime || r.zone);
  const bagTotals = {
    general: form.bagWork.reduce((s, r) => s + (Number(r.general) || 0), 0),
    food:    form.bagWork.reduce((s, r) => s + (Number(r.food) || 0), 0),
    recycle: form.bagWork.reduce((s, r) => s + (Number(r.recycle) || 0), 0),
  };
  const abnormalInsp = INSPECTION_ITEMS.filter((i) => form.inspection[i.key] !== i.opts[0]);
  const hasMaint = form.maintCompany || form.maintContent || form.maintCost;
  const hasBagB = Object.values(form.bagMachineWork).some((v) => Number(v) > 0);
  const hasBagC = Object.values(form.largeWasteWork).some((v) => Number(v) > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCancel}>
      <div
        className="w-full bg-surface rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface px-4 py-3 border-b border-line flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="text-base font-extrabold text-ink">제출 전 최종 확인</div>
          <button type="button" onClick={onCancel} className="text-ink-muted text-lg font-bold px-2">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 text-sm">
          {/* 기본정보 */}
          <section>
            <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">기본정보</div>
            <div className="bg-slate-50 rounded-xl border border-line p-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono">
              <Row label="차량" value={vehicle?.vehicleNo ?? '—'} />
              <Row label="작성자" value={driverName} />
              <Row label="작성일자" value={form.logDate} />
              <Row label="동승자" value={passengerNames.join(', ') || '없음'} />
              <Row label="전일누적" value={form.prevMileage ? `${Number(form.prevMileage).toLocaleString()} km` : '—'} />
              <Row label="금일누적" value={`${Number(form.todayMileage).toLocaleString()} km`} />
              {dist && <Row label="운행거리" value={`${dist} km`} />}
              {form.fuelUsed.trim() !== '' && <Row label="주유량" value={`${form.fuelUsed} L`} />}
            </div>
          </section>

          {/* 운행내역 */}
          {filledOps.length > 0 && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">차량운행내역</div>
              <div className="bg-slate-50 rounded-xl border border-line divide-y divide-line">
                {filledOps.map((r, i) => (
                  <div key={i} className="px-3 py-2 text-xs font-mono flex gap-3">
                    <span className="text-ink-muted w-8 flex-shrink-0">{form.operationRows.indexOf(r) + 1}차</span>
                    <span>{r.startTime && r.endTime ? `${r.startTime}~${r.endTime}` : r.startTime || ''}</span>
                    {r.zone && <span className="text-ink">{r.zone}</span>}
                    {r.note && <span className="text-ink-muted ml-auto">{r.note}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 작업내역 A */}
          {(bagTotals.general > 0 || bagTotals.food > 0 || bagTotals.recycle > 0) && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">작업내역 A (kg)</div>
              <div className="bg-blue-50 rounded-xl border border-blue-200 px-3 py-2 text-xs font-mono flex gap-6">
                {bagTotals.general > 0 && <span>일반 {bagTotals.general} kg</span>}
                {bagTotals.food > 0 && <span>음식물 {bagTotals.food} kg</span>}
                {bagTotals.recycle > 0 && <span>재활용 {bagTotals.recycle} kg</span>}
              </div>
            </section>
          )}

          {/* 작업내역 B·C 요약 */}
          {(hasBagB || hasBagC) && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">작업내역 B·C</div>
              <div className="bg-green-50 rounded-xl border border-green-200 px-3 py-2 text-xs font-mono space-y-1">
                {hasBagB && (
                  <div>
                    <span className="font-extrabold text-green-800">B — 종량제봉투: </span>
                    {Object.entries(form.bagMachineWork)
                      .filter(([, v]) => Number(v) > 0)
                      .map(([k, v]) => `${BAG_MACHINE_LABEL[k] ?? k.replace(/_/g, ' ')} ${v}`)
                      .join(' / ')}
                  </div>
                )}
                {hasBagC && (
                  <div>
                    <span className="font-extrabold text-amber-800">C — 대형폐기물: </span>
                    {Object.entries(form.largeWasteWork)
                      .filter(([, v]) => Number(v) > 0)
                      .map(([k, v]) => `${LARGE_WASTE_LABEL[k] ?? k} ${v}점`)
                      .join(' / ')}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 차량점검 이상 */}
          {abnormalInsp.length > 0 && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-warn mb-2 tracking-wider">⚠ 차량점검 이상 항목</div>
              <div className="bg-amber-50 rounded-xl border border-amber-300 px-3 py-2 text-xs font-mono space-y-0.5">
                {abnormalInsp.map((i) => (
                  <div key={i.key} className="text-amber-800 font-bold">
                    {i.label}: {form.inspection[i.key]}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 정비이력 */}
          {hasMaint && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">정비이력</div>
              <div className="bg-slate-50 rounded-xl border border-line px-3 py-2 text-xs font-mono space-y-0.5">
                {form.maintCompany && <div>업체: {form.maintCompany}</div>}
                {form.maintContent && <div>내용: {form.maintContent}</div>}
                {form.maintCost && <div>비용: {Number(form.maintCost).toLocaleString()}원</div>}
              </div>
            </section>
          )}

          {/* 특이사항 */}
          {form.note.trim() && (
            <section>
              <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2 tracking-wider">특이사항</div>
              <div className="bg-slate-50 rounded-xl border border-line px-3 py-2 text-xs font-mono whitespace-pre-wrap">
                {form.note}
              </div>
            </section>
          )}
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-line grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel}
            className="py-3.5 rounded-xl border-2 border-line text-sm font-extrabold text-ink active:scale-[0.99]">
            ← 수정
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting}
            className="py-3.5 rounded-xl bg-accent text-white text-sm font-extrabold shadow-card active:scale-[0.99] disabled:opacity-50">
            {submitting ? '제출 중…' : '🚛 제출 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-ink-muted w-16 flex-shrink-0">{label}</span>
      <span className="font-bold text-ink truncate">{value}</span>
    </div>
  );
}

/* ─── 내역 확인 패널 (#7-A) ─── */

type LogItem = {
  id: string;
  logDate: string;
  status: string;
  vehicle: { no: string; type: string; ton: string | null };
  startMileage: number | null;
  endMileage: number | null;
  mileageDelta: number | null;
  fuelUsed: number | null;
  routeDetail: string | null;
};

const LOG_STATUS_LABEL: Record<string, string> = {
  DRAFT: '임시저장', SUBMITTED: '제출완료', APPROVED: '승인완료', REJECTED: '반려',
};
const LOG_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
};

function HistoryPanel() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/vehicle-logs?limit=30')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4">
      <p className="text-xs font-bold text-ink-muted px-1 mb-3">최근 30건 · 본인 제출 내역</p>
      {loading && <div className="py-10 text-center text-slate-500 text-sm">로딩 중…</div>}
      {!loading && items.length === 0 && (
        <div className="bg-surface border border-line rounded-xl py-12 text-center text-sm text-slate-500 font-bold">
          제출한 차량일지가 없습니다.
        </div>
      )}
      <div className="space-y-3 overflow-y-auto max-h-[calc(100dvh-180px)]">
      {items.map((log) => {
        const detail = parseRouteDetail(log.routeDetail);
        const isOpen = expanded === log.id;
        return (
          <article key={log.id} className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-surface-soft"
              onClick={() => setExpanded(isOpen ? null : log.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-ink">{log.logDate}</span>
                  <span className={`text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full border ${LOG_STATUS_COLOR[log.status] ?? 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                    {LOG_STATUS_LABEL[log.status] ?? log.status}
                  </span>
                </div>
                <div className="text-xs font-mono text-ink-muted mt-0.5">
                  {log.vehicle.no} · {log.vehicle.type}{log.vehicle.ton ? ` ${log.vehicle.ton}t` : ''}
                  {log.mileageDelta != null && ` · ${log.mileageDelta.toLocaleString()}km`}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                className={`flex-shrink-0 text-ink-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-line space-y-2 text-xs">
                <div className="pt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                  {log.startMileage != null && <span>시작거리: {log.startMileage.toLocaleString()}km</span>}
                  {log.endMileage != null && <span>종료거리: {log.endMileage.toLocaleString()}km</span>}
                  {log.fuelUsed != null && <span>주유량: {log.fuelUsed}L</span>}
                  {typeof detail.passengers === 'string' && detail.passengers && <span>동승: {detail.passengers}</span>}
                  {Array.isArray(detail.operationRows) && (detail.operationRows as OperationRow[]).some((r) => r.startTime || r.zone) && (
                    <div className="col-span-2">
                      {(detail.operationRows as OperationRow[]).filter((r) => r.startTime || r.zone).map((r, i) => (
                        <div key={i} className="font-mono">{i + 1}차: {r.startTime}{r.endTime ? `–${r.endTime}` : ''}{r.zone ? ` ${r.zone}` : ''}{r.note ? ` (${r.note})` : ''}</div>
                      ))}
                    </div>
                  )}
                  {!Array.isArray(detail.operationRows) && typeof detail.operationPeriod === 'string' && detail.operationPeriod && (
                    <span className="col-span-2">운행기간/경로: {detail.operationPeriod}</span>
                  )}
                  {typeof detail.note === 'string' && detail.note && <span className="col-span-2">특이사항: {detail.note}</span>}
                </div>
                {Array.isArray(detail.bagWork) && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="font-extrabold text-ink mb-1">작업내역 A (kg)</div>
                    {(detail.bagWork as Record<string, string>[]).map((row, i) => (
                      <div key={i} className="text-[0.6875rem] font-mono">
                        {`${i + 1}차 | 일반 ${row.general ?? 0} · 음식 ${row.food ?? 0} · 재활 ${row.recycle ?? 0} · 반입: ${row.disposalSite ?? '-'}${row.note ? ` · 비고: ${row.note}` : ''}`}
                      </div>
                    ))}
                  </div>
                )}
                {detail.largeWasteWork != null && typeof detail.largeWasteWork === 'object' &&
                  Object.values(detail.largeWasteWork as Record<string, string>).some((v) => Number(v) > 0) && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="font-extrabold text-ink mb-1">작업내역 C — 대형폐기물</div>
                    <div className="font-mono text-[0.6875rem]">
                      {Object.entries(detail.largeWasteWork as Record<string, string>)
                        .filter(([, v]) => Number(v) > 0)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
      </div>
    </div>
  );
}

function parseRouteDetail(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { return {}; }
}

function translateVehicleLogError(code?: string): string | null {
  switch (code) {
    case 'invalid_vehicle': return '차량이 소속 업체에 등록되지 않았습니다.';
    case 'vehicle_retired': return '폐차 처리된 차량입니다.';
    case 'duplicate_log_today': return '오늘 이미 제출된 차량일지가 있습니다. 반려 처리 후 재작성하세요.';
    case 'mileage_required': return '금일누적거리를 입력해 주세요.';
    case 'unauthenticated': return '로그인이 만료되었습니다.';
    default: return null;
  }
}

async function handleReceiptPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

const INPUT_CLS =
  'w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono focus:outline-none focus:border-accent bg-white';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line bg-surface-soft text-[0.75rem] font-extrabold text-ink tracking-tight">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-mono font-extrabold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-surface rounded-t-2xl max-h-[75vh] flex flex-col">
        <div className="sticky top-0 bg-surface px-4 py-3 border-b border-line flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-extrabold text-ink">{title}</div>
          <button type="button" onClick={onClose} className="text-ink-muted text-lg font-bold px-2">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">{children}</div>
      </div>
    </div>
  );
}
