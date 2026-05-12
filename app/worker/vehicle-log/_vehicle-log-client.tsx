'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

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

type FormState = {
  logDate: string;
  prevMileage: string;
  todayMileage: string;
  operationPeriod: string;
  fuelUsed: string;
  fuelCost: string;
  ureaUsed: string;
  ureaCost: string;
  bags30L: string;
  bags50L: string;
  bags75L: string;
  inspection: Record<InspectionKey, string>;
  maintCompany: string;
  maintContent: string;
  maintCost: string;
  receiptPhoto: string; /* base64 data URL */
  note: string;
};

function defaultForm(lastEndMileage: number | null): FormState {
  const today = new Date().toISOString().slice(0, 10);
  const defaultInspection = Object.fromEntries(
    INSPECTION_ITEMS.map((i) => [i.key, i.opts[0]])
  ) as Record<InspectionKey, string>;
  return {
    logDate: today,
    prevMileage: lastEndMileage != null ? String(lastEndMileage) : '',
    todayMileage: '',
    operationPeriod: '',
    fuelUsed: '',
    fuelCost: '',
    ureaUsed: '',
    ureaCost: '',
    bags30L: '',
    bags50L: '',
    bags75L: '',
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
  defaultVehicleId: string | null;
  driverName: string;
  lastEndMileage: number | null;
};

/* ─── 메인 컴포넌트 ─── */

export default function VehicleLogClient({ vehicles, coworkers, defaultVehicleId, driverName, lastEndMileage }: Props) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? '');
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const [showPassengerPicker, setShowPassengerPicker] = useState(false);
  const [form, setForm] = useState<FormState>(() => defaultForm(lastEndMileage));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function setInspection(key: InspectionKey, value: string) {
    setForm((p) => ({ ...p, inspection: { ...p.inspection, [key]: value } }));
  }

  function togglePassenger(id: string) {
    setSelectedPassengerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedPassengerNames = coworkers
    .filter((w) => selectedPassengerIds.includes(w.id))
    .map((w) => w.name);

  /* 영수증 사진 캡처 → canvas 리사이즈 → base64 */
  async function handleReceiptPhoto(file: File) {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function submit() {
    if (!vehicleId) { alert('차량을 선택해 주세요.'); return; }
    if (!form.todayMileage) { alert('금일누적거리를 입력해 주세요.'); return; }

    setSubmitting(true);
    setResult(null);

    const routeDetail = JSON.stringify({
      passengers: selectedPassengerNames.join(', '),
      operationPeriod: form.operationPeriod,
      fuelCost: Number(form.fuelCost) || 0,
      ureaUsed: Number(form.ureaUsed) || 0,
      ureaCost: Number(form.ureaCost) || 0,
      bags30L: Number(form.bags30L) || 0,
      bags50L: Number(form.bags50L) || 0,
      bags75L: Number(form.bags75L) || 0,
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
          fuelUsed: Number(form.fuelUsed) || undefined,
          routeDetail,
        }),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        setResult({ ok: false, message: d.error ?? '저장 실패' });
        return;
      }
      const { log } = await createRes.json();

      const submitRes = await fetch(`/api/vehicle-logs/${log.id}/submit`, { method: 'POST' });
      if (!submitRes.ok) {
        const d = await submitRes.json().catch(() => ({}));
        setResult({ ok: false, message: d.error ?? '제출 실패' });
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

  /* 탭바 높이(4rem=64px) + 버튼영역(~5rem) = pb-36 확보 */
  return (
    <div className="pb-36">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">차량일지 작성</h1>
      </div>

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
            <button
              type="button"
              onClick={() => setShowVehiclePicker(true)}
              className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-extrabold border border-accent/30 active:scale-95"
            >
              차량 변경
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowVehiclePicker(true)}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-accent text-accent text-sm font-bold"
          >
            차량 선택
          </button>
        )}
      </div>

      {/* 차량 선택 바텀시트 */}
      {showVehiclePicker && (
        <BottomSheet title="차량 선택" onClose={() => setShowVehiclePicker(false)}>
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { setVehicleId(v.id); setShowVehiclePicker(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition active:scale-[0.99] ${
                vehicleId === v.id ? 'border-accent bg-accent/5' : 'border-line bg-surface'
              }`}
            >
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
                <button
                  key={w.id}
                  type="button"
                  onClick={() => togglePassenger(w.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition active:scale-[0.99] ${
                    checked ? 'border-accent bg-accent/5' : 'border-line bg-surface'
                  }`}
                >
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
          <button
            type="button"
            onClick={() => setShowPassengerPicker(false)}
            className="w-full mt-2 py-3 rounded-xl bg-accent text-white font-extrabold text-sm active:scale-[0.99]"
          >
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

            {/* 동승자 — 직원 목록 멀티선택 */}
            <Field label="동승자">
              <button
                type="button"
                onClick={() => setShowPassengerPicker(true)}
                className={`${INPUT_CLS} text-left flex items-center justify-between gap-2 min-h-[44px]`}
              >
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

            <Field label="운행기간 / GPS 정차지점">
              <textarea value={form.operationPeriod}
                onChange={(e) => setField('operationPeriod', e.target.value)}
                placeholder="예: 09:00~18:00 / 1번 정류장 → 시청 → 환경사업소"
                rows={2} className={`${INPUT_CLS} resize-none`} />
            </Field>
          </div>
        </Card>

        {/* ── Card 2: 주유 / 요소수 ── */}
        <Card title="주유 / 요소수">
          <div className="grid grid-cols-2 gap-3">
            <Field label="주유량 (ℓ)">
              <input type="number" inputMode="decimal" step="0.1" min="0"
                value={form.fuelUsed} onChange={(e) => setField('fuelUsed', e.target.value)}
                placeholder="0.0" className={INPUT_CLS} />
            </Field>
            <Field label="주유금액 (원)">
              <input type="number" inputMode="numeric" min="0"
                value={form.fuelCost} onChange={(e) => setField('fuelCost', e.target.value)}
                placeholder="0" className={INPUT_CLS} />
            </Field>
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
        </Card>

        {/* ── Card 3: 공공봉투 사용 ── */}
        <Card title="공공봉투 사용">
          <div className="grid grid-cols-3 gap-3">
            <Field label="30ℓ (장)">
              <input type="number" inputMode="numeric" min="0"
                value={form.bags30L} onChange={(e) => setField('bags30L', e.target.value)}
                placeholder="0" className={INPUT_CLS} />
            </Field>
            <Field label="50ℓ (장)">
              <input type="number" inputMode="numeric" min="0"
                value={form.bags50L} onChange={(e) => setField('bags50L', e.target.value)}
                placeholder="0" className={INPUT_CLS} />
            </Field>
            <Field label="75ℓ (장)">
              <input type="number" inputMode="numeric" min="0"
                value={form.bags75L} onChange={(e) => setField('bags75L', e.target.value)}
                placeholder="0" className={INPUT_CLS} />
            </Field>
          </div>
          {(form.bags30L || form.bags50L || form.bags75L) && (
            <div className="mt-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-800">
              합계 {(Number(form.bags30L) || 0) + (Number(form.bags50L) || 0) + (Number(form.bags75L) || 0)} 장
            </div>
          )}
        </Card>

        {/* ── Card 4: 차량점검 — 원래 1열 레이아웃 ── */}
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
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setInspection(item.key, opt)}
                        className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-extrabold transition active:scale-95 border ${
                          val === opt
                            ? opt === '양호' || opt === '예'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : opt === '이상' || opt === '아니오'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-red-600 text-white border-red-600'
                            : 'bg-surface text-ink-muted border-line hover:bg-surface-soft'
                        }`}
                      >
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

            {/* 영수증(거래명세표) 촬영 */}
            <Field label="영수증(거래명세표)">
              <div className="space-y-2">
                {form.receiptPhoto ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.receiptPhoto} alt="영수증" className="w-full rounded-lg border border-line object-cover max-h-48" />
                    <button
                      type="button"
                      onClick={() => setField('receiptPhoto', '')}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center font-bold active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="w-full py-4 rounded-lg border-2 border-dashed border-line bg-surface-soft flex flex-col items-center gap-1.5 active:scale-[0.99] text-ink-muted"
                  >
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-bold">영수증 촬영</span>
                  </button>
                )}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await handleReceiptPhoto(file);
                      setField('receiptPhoto', dataUrl);
                    } catch { /* 촬영 실패 무시 */ }
                    e.target.value = '';
                  }}
                />
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

      {/* Sticky 제출 버튼 — 탭바(h-16=4rem) 위에 띄우기 */}
      {!result?.ok && (
        <div
          className="fixed left-0 right-0 z-40 bg-surface border-t border-line px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !vehicleId || !form.todayMileage}
            className="w-full py-3.5 rounded-xl bg-accent text-white text-base font-black shadow-card active:scale-[0.99] disabled:opacity-50 transition"
          >
            {submitting ? '제출 중…' : '🚛 차량일지 제출'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── 이미지 리사이즈 헬퍼 ─── */

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

/* ─── 공용 UI ─── */

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
