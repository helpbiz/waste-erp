'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VEHICLE_TYPE_OPTIONS, VEHICLE_TYPE_LABEL, type VehicleTypeKey } from '@/lib/vehicle-types';

const INSPECTION_KEY_LABEL: Record<string, string> = {
  safetyBar: '안전멈춤Bar', handSwitch: '양손조작안전스위치', dashcam: '블랙박스',
  turnSignal: '방향지시등', engineOil: '엔진오일', lubricant: '윤활제',
  brake: '브레이크', tire: '타이어', headlight: '전조등', carWash: '세차여부',
};
const BAG_MACHINE_LABEL: Record<string, string> = {
  food_1L: '음식물 1L', food_2L: '음식물 2L', food_3L: '음식물 3L', food_5L: '음식물 5L', food_10L: '음식물 10L',
  living_5L: '생활 5L', living_10L: '생활 10L', living_20L: '생활 20L', living_30L: '생활 30L', living_50L: '생활 50L', living_75L: '생활 75L',
  reuse_10L: '재사용 10L', reuse_20L: '재사용 20L',
  illegal_20: '무단투기(20기준)', special: '특수', deadAnimal: '동물사채(마대)',
};
const LARGE_WASTE_LABEL: Record<string, string> = {
  furniture: '가구류', chair: '의자류', sofa: '쇼파류', bed: '침대류',
  appliance: '가전제품', extinguisher: '소화기', household: '생활용품', other: '기타',
  illegalTotal: '무단투기 총합',
};

export type VehicleRow = {
  id: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleTon: string | null;
  capacityTon: number | null;
  fuelType: string;
  yearManufactured: number | null;
  registrationDate: string | null; // 'YYYY-MM-DD'
  status: string;        // ACTIVE / MAINTENANCE / RETIRED
  driverId: string | null;
  driverName: string | null;
  passenger1Id: string | null;
  passenger1Name: string | null;
  passenger2Id: string | null;
  passenger2Name: string | null;
  operationStartDate: string | null; // 'YYYY-MM-DD'
  initialMileage: number | null;
  totalMileage: number | null;
  logStatus: string | null;
  wasteWeightKg: number | null;
};

export type WorkerOpt = { id: string; name: string };

export type LogRow = {
  id: string;
  status: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleTon: string | null;
  fuelType: string | null;
  driverName: string;
  startMileage: number | null;
  endMileage: number | null;
  fuelUsed: number | null;
  wasteWeightKg: number | null;
  tripCount: number | null;
  routeDetail: string | null;
};

const TYPE_LABEL = VEHICLE_TYPE_LABEL as Record<string, string>;
const FUEL_TYPE_LABEL: Record<string, string> = {
  DIESEL: '경유', LPG: 'LPG', ELECTRIC: '전기', CNG: 'CNG', GASOLINE: '휘발유',
};

export default function VehiclesClient({
  vehicles,
  logs,
  workers,
  isManager,
  todayLabel,
  selectedDate,
}: {
  vehicles: VehicleRow[];
  logs: LogRow[];
  workers: WorkerOpt[];
  isManager: boolean;
  todayLabel: string;
  selectedDate?: string;
}) {
  const router = useRouter();
  const [dateInput, setDateInput] = useState(selectedDate ?? todayLabel);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const to   = dateInput;
      const res  = await fetch(`/api/vehicle-logs/export?from=${from}&to=${to}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `차량운행일지_${from.slice(0, 7)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(false); }
  }

  function navigateDate(date: string) {
    router.push(`/vehicles?date=${date}`);
  }
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<VehicleRow | 'NEW' | null>(null);
  const [retireFor, setRetireFor] = useState<VehicleRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<VehicleRow | null>(null);

  const running = vehicles.filter((v) => v.status === 'ACTIVE' && v.logStatus).length;
  const maintenance = vehicles.filter((v) => v.status === 'MAINTENANCE').length;
  const idle = vehicles.filter((v) => v.status === 'ACTIVE' && !v.logStatus).length;
  const totalWaste = logs.reduce((sum, l) => sum + (l.wasteWeightKg ?? 0), 0);
  const submittedCount = logs.filter((l) => l.status === 'SUBMITTED').length;

  async function call(path: string, body?: object, method?: string) {
    setBusy(true);
    setError(null);
    try {
      const m = method ?? (body !== undefined ? 'POST' : 'DELETE');
      const res = await fetch(path, {
        method: m,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '요청 실패');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('네트워크 오류');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">차량 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">
            {todayLabel} · Plan §2-4 / §3-3 · 차량 마스터 + 운행일지 결재
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {submittedCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-blue-100 text-info border border-blue-200">
              결재 대기 {submittedCount}건
            </span>
          )}
          {isManager && (
            <a href="/vehicles/logs-overview"
              className="px-3 py-1.5 rounded-md border border-line bg-white text-xs font-extrabold text-ink-muted hover:bg-slate-50 transition">
              📋 차량일지 현황
            </a>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-1.5 rounded-md border border-line bg-white text-xs font-extrabold text-ink-muted hover:bg-slate-50 transition flex items-center gap-1 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? '생성 중…' : '운행일지 Excel'}
          </button>
          {isManager && (
            <button
              onClick={() => setEditing('NEW')}
              className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 shadow-card"
            >
              + 차량 등록
            </button>
          )}
        </div>
      </header>

      {/* 요약 카드 — 사용자 요청 2026-04-28: 다른 페이지(특히 attendance KpiCard)와 톤 통일.
          tone prop 을 semantic enum (default/success/warn/accent) 으로 변경 + 그라데이션 배경. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="총 차량" value={`${vehicles.length}대`} tone="default" />
        <Stat label="운행중" value={`${running}대`} tone="success" />
        <Stat label="정비중" value={`${maintenance}대`} tone="warn" />
        <Stat label="금일 수집량" value={`${(totalWaste / 1000).toFixed(1)}톤`} tone="accent" />
      </section>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 차량 그리드 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <header className="px-5 py-3.5 bg-surface-soft border-b-2 border-line">
          <h3 className="text-sm font-extrabold text-ink">차량 현황 ({vehicles.length}대)</h3>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
          {vehicles.map((v) => {
            const dotClass =
              v.status === 'RETIRED'
                ? 'bg-ink-faint opacity-30'
                : v.status === 'MAINTENANCE'
                ? 'bg-warn'
                : v.logStatus
                ? 'bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.18)]'
                : 'bg-ink-faint';
            /* 사용자 요청 2026-04-29: 차량번호 → 우측으로 이동, 하단엔 운전자 + 수거원 이름.
               1줄: [● 유형/톤] 좌, [차량번호] 우
               2줄: 🚛 운전자 · 👥 수거원1, 수거원2
               전체 카드 클릭 → 조회 모달 (별도 hover 아이콘 제거, 클릭 영역 명확화). */
            const statusLabel = v.status === 'RETIRED'
              ? '폐차'
              : v.status === 'MAINTENANCE'
              ? '정비중'
              : v.logStatus === 'APPROVED'
              ? '승인 완료'
              : v.logStatus === 'SUBMITTED'
              ? '제출(결재대기)'
              : v.logStatus === 'DRAFT'
              ? '작성중'
              : '대기';
            const typeStr = `${TYPE_LABEL[v.vehicleType] ?? v.vehicleType} ${v.vehicleTon ?? ''}`.trim();
            const passengers = [v.passenger1Name, v.passenger2Name].filter(Boolean).join(', ');
            const peopleParts: string[] = [];
            if (v.driverName) peopleParts.push(`🚛 ${v.driverName}`);
            if (passengers) peopleParts.push(`👥 ${passengers}`);
            const peopleStr = peopleParts.join(' · ');
            const isClickable = isManager && v.status !== 'RETIRED';

            const cardInner = (
              <>
                {/* 1줄: 좌측 [상태 dot + 유형/톤] / 우측 [차량번호] */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} aria-label={statusLabel} />
                    <span className="text-sm font-bold text-ink-muted truncate">{typeStr}</span>
                  </div>
                  {/* 사용자 피드백 2026-04-29: Pretendard black 으로 굵어진 만큼 사이즈 한 단계 다운 (text-lg 18px → text-base 16px). */}
                  <span className="font-sans text-base font-black text-ink tracking-tight truncate flex-shrink-0">
                    {v.vehicleNo}
                  </span>
                </div>
                {/* 2줄: 운전자 + 수거원 */}
                <div className="text-sm font-bold text-ink mt-1.5 truncate">
                  {peopleStr || <span className="text-ink-faint">— 인원 미배정</span>}
                </div>
              </>
            );

            const baseCls = `bg-surface-alt border border-line rounded-lg px-3 py-2.5 ${v.status === 'RETIRED' ? 'opacity-50' : ''}`;

            return isClickable ? (
              <button
                key={v.id}
                type="button"
                onClick={() => setEditing(v)}
                title={`${v.vehicleNo} 조회 · ${statusLabel}`}
                aria-label={`${v.vehicleNo} 조회`}
                className={`${baseCls} text-left hover:border-accent hover:shadow-card transition-colors`}
              >
                {cardInner}
              </button>
            ) : (
              <div key={v.id} className={baseCls} title={statusLabel}>
                {cardInner}
              </div>
            );
          })}
        </div>
      </section>

      {/* 운행일지 — 날짜 조회 지원 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <header className="px-5 py-3.5 bg-surface-soft border-b-2 border-line flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-extrabold text-ink">운행일지 ({logs.length}건)</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="px-2 py-1 rounded border border-line bg-white text-sm font-mono font-bold focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => navigateDate(dateInput)}
              className="px-3 py-1 rounded bg-accent text-white text-xs font-extrabold hover:bg-cyan-800"
            >
              조회
            </button>
            <button
              onClick={() => { setDateInput(todayLabel); navigateDate(todayLabel); }}
              className="px-2 py-1 rounded border border-line text-xs font-bold hover:bg-surface"
            >
              오늘
            </button>
            <span className="text-[0.6875rem] font-mono font-bold text-ink-muted">{selectedDate ?? todayLabel}</span>
          </div>
        </header>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="운행일지 표">
        <table className="w-full min-w-[640px] text-[0.8125rem]">
          <thead>
            <tr>
              {['차량', '기사', '주행거리', '주유량', '유종', '회', '상태', '상세', '액션'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink bg-surface-soft border-b-2 border-line-strong font-mono whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-muted font-bold">
                  오늘 작성된 운행일지가 없습니다.
                </td>
              </tr>
            )}
            {logs.map((l, i) => {
              const km = l.startMileage != null && l.endMileage != null ? l.endMileage - l.startMileage : null;
              return (
                <React.Fragment key={l.id}>
                <tr className={i % 2 === 1 ? 'bg-surface-soft' : ''}>
                  <td className="px-3 py-2.5 border-b border-line">
                    <div className="font-mono font-extrabold text-ink">{l.vehicleNo}</div>
                    <div className="text-[0.625rem] font-bold text-ink-muted">{TYPE_LABEL[l.vehicleType] ?? l.vehicleType} {l.vehicleTon}</div>
                  </td>
                  <td className="px-3 py-2.5 border-b border-line text-ink font-bold">{l.driverName}</td>
                  <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                    {km != null ? `${km.toLocaleString()} km` : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                    {l.fuelUsed != null ? `${l.fuelUsed.toFixed(1)} L` : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                    {l.fuelType ? FUEL_TYPE_LABEL[l.fuelType] ?? l.fuelType : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                    {l.tripCount ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-line">
                    <LogStatusChip status={l.status} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-line">
                    <button
                      onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                      className="px-2 py-1 rounded text-[0.6875rem] font-extrabold border border-line hover:bg-surface-soft"
                    >
                      {expandedLogId === l.id ? '접기' : '상세'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 border-b border-line">
                    {isManager && l.status === 'SUBMITTED' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => call(`/api/vehicle-logs/${l.id}/approve`, undefined, 'POST')}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-success text-white text-xs font-extrabold hover:bg-green-700 active:scale-95 disabled:opacity-50"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => setRejectFor(l.id)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md border border-danger text-danger text-xs font-extrabold hover:bg-danger hover:text-white active:scale-95 disabled:opacity-50"
                        >
                          반려
                        </button>
                      </div>
                    )}
                    {l.status === 'APPROVED' && (
                      <span className="text-[0.6875rem] font-mono font-bold text-success">✓ 정산 반영</span>
                    )}
                    {l.status === 'DRAFT' && (
                      <span className="text-[0.6875rem] font-mono font-bold text-ink-faint">작성자 제출 대기</span>
                    )}
                  </td>
                </tr>
                {expandedLogId === l.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={9} className="px-4 py-3 border-b border-line">
                      <VehicleLogDetail routeDetail={l.routeDetail} startMileage={l.startMileage} endMileage={l.endMileage} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {rejectFor && (
        <RejectModal
          onCancel={() => setRejectFor(null)}
          onSubmit={async (reason) => {
            const ok = await call(`/api/vehicle-logs/${rejectFor}/reject`, { reason });
            if (ok) setRejectFor(null);
          }}
        />
      )}

      {editing && (
        <VehicleFormModal
          initial={editing === 'NEW' ? null : editing}
          workers={workers}
          onCancel={() => { setEditing(null); setSaveError(null); }}
          errorMsg={saveError}
          onSubmit={async (body) => {
            const path = editing === 'NEW' ? '/api/vehicles' : `/api/vehicles/${editing.id}`;
            const method = editing === 'NEW' ? 'POST' : 'PATCH';
            setBusy(true);
            setSaveError(null);
            try {
              const res = await fetch(path, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const data = await res.json();
              if (!res.ok) {
                setSaveError(translateError(data?.error) ?? data?.message ?? data?.error ?? '저장에 실패했습니다.');
                return false;
              }
              setEditing(null);
              setSaveError(null);
              router.refresh();
              return true;
            } catch {
              setSaveError('네트워크 오류가 발생했습니다.');
              return false;
            } finally {
              setBusy(false);
            }
          }}
          onDelete={editing !== 'NEW' ? () => { setEditing(null); setSaveError(null); setDeleteFor(editing); } : undefined}
          busy={busy}
        />
      )}

      {retireFor && (
        <RetireModal
          vehicle={retireFor}
          onCancel={() => setRetireFor(null)}
          onSubmit={async (reason) => {
            const ok = await call(`/api/vehicles/${retireFor.id}/retire`, { reason });
            if (ok) setRetireFor(null);
          }}
        />
      )}

      {deleteFor && (
        <DeleteVehicleModal
          vehicle={deleteFor}
          onCancel={() => setDeleteFor(null)}
          onSubmit={async () => {
            const ok = await call(`/api/vehicles/${deleteFor.id}`, undefined);
            if (ok) setDeleteFor(null);
          }}
        />
      )}

      {/* 원가산정 연계 안내 박스 제거 (사용자 요청 2026-04-28). */}
    </div>
  );
}

function Stat({
  label, value, tone = 'default',
}: {
  label: string; value: string;
  tone?: 'default' | 'accent' | 'success' | 'warn';
}) {
  /* 사용자 요청 2026-04-28: 다른 페이지(attendance KpiCard) 와 동일 그라데이션 톤. */
  const colors: Record<string, { card: string; value: string }> = {
    default: { card: 'bg-gradient-to-br from-slate-100 to-white border-slate-300', value: 'text-ink' },
    accent:  { card: 'bg-gradient-to-br from-cyan-50 to-white border-cyan-300',    value: 'text-cyan-900' },
    success: { card: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300', value: 'text-emerald-900' },
    warn:    { card: 'bg-gradient-to-br from-amber-50 to-white border-amber-300',  value: 'text-amber-900' },
  };
  const c = colors[tone];
  return (
    /* 사용자 요청 2026-04-29: 값 폰트 2단계 다운 (text-3xl 30px → text-xl 20px).
       라벨(text-sm 14px) 은 가독성 위해 유지. */
    <div className={`${c.card} border rounded-xl px-4 py-3 shadow-card`}>
      <div className="text-sm font-extrabold text-ink-muted tracking-widest uppercase">{label}</div>
      <div className={`mt-1.5 text-xl font-black font-mono tracking-tight ${c.value}`}>{value}</div>
    </div>
  );
}

function LogStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:     'bg-amber-100 text-warn border-amber-200',
    SUBMITTED: 'bg-blue-100 text-info border-blue-200',
    APPROVED:  'bg-green-100 text-success border-green-200',
  };
  const lbl: Record<string, string> = { DRAFT: '작성중', SUBMITTED: '결재대기', APPROVED: '승인' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[status] ?? ''}`}>
      {lbl[status] ?? status}
    </span>
  );
}

/* ─────────────── 차량 등록·수정 모달 ─────────────── */

type VehicleFormPayload = {
  vehicleNo: string;
  vehicleType: VehicleTypeKey;
  vehicleTon: string | null;
  capacityTon: number | null;
  fuelType: 'DIESEL' | 'LPG' | 'ELECTRIC' | 'CNG' | 'GASOLINE';
  yearManufactured: number | null;
  registrationDate: string | null;
  status?: 'ACTIVE' | 'MAINTENANCE';
  driverId: string | null;
  passenger1Id: string | null;
  passenger2Id: string | null;
  operationStartDate: string | null;
  initialMileage: number | null;
};

function VehicleFormModal({
  initial,
  workers,
  onCancel,
  onSubmit,
  onDelete,
  busy,
  errorMsg,
}: {
  initial: VehicleRow | null;
  workers: WorkerOpt[];
  onCancel: () => void;
  onSubmit: (body: Partial<VehicleFormPayload>) => Promise<boolean>;
  onDelete?: () => void;
  busy: boolean;
  errorMsg?: string | null;
}) {
  const isEdit = !!initial;
  const [vehicleNo, setVehicleNo] = useState(initial?.vehicleNo ?? '');
  const [vehicleType, setVehicleType] = useState<VehicleFormPayload['vehicleType']>(
    (initial?.vehicleType as VehicleFormPayload['vehicleType']) ?? 'COMPACTOR_REFUSE'
  );
  const [vehicleTon, setVehicleTon] = useState(initial?.vehicleTon ?? '');
  const [capacityTon, setCapacityTon] = useState<string>(
    initial?.capacityTon != null ? String(initial.capacityTon) : ''
  );
  const [fuelType, setFuelType] = useState<VehicleFormPayload['fuelType']>(
    (initial?.fuelType as VehicleFormPayload['fuelType']) ?? 'DIESEL'
  );
  const [yearManufactured, setYearManufactured] = useState<string>(
    initial?.yearManufactured != null ? String(initial.yearManufactured) : ''
  );
  const [registrationDate, setRegistrationDate] = useState<string>(
    initial?.registrationDate ?? ''
  );
  const [status, setStatus] = useState<VehicleFormPayload['status']>(
    (initial?.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'ACTIVE')
  );
  const [driverId, setDriverId] = useState<string>(initial?.driverId ?? '');
  const [passenger1Id, setPassenger1Id] = useState<string>(initial?.passenger1Id ?? '');
  const [passenger2Id, setPassenger2Id] = useState<string>(initial?.passenger2Id ?? '');
  const [opStart, setOpStart] = useState<string>(initial?.operationStartDate ?? '');
  const [initialMileage, setInitialMileage] = useState<string>(
    initial?.initialMileage != null ? String(initial.initialMileage) : ''
  );

  /* 운전자/동승자1/2 중복 방지 — UI 사전 차단 */
  const crewIds = [driverId, passenger1Id, passenger2Id].filter(Boolean);
  const hasDuplicateCrew = new Set(crewIds).size !== crewIds.length;

  const validNo = /^\d{2,3}[가-힣]\d{4}$/.test(vehicleNo.trim());
  const canSubmit = validNo && !busy && !hasDuplicateCrew;

  async function handleSave() {
    const body: Partial<VehicleFormPayload> = {
      vehicleNo: vehicleNo.trim(),
      vehicleType,
      vehicleTon: vehicleTon.trim() || null,
      capacityTon: capacityTon ? Number(capacityTon) : null,
      fuelType,
      yearManufactured: yearManufactured ? Number(yearManufactured) : null,
      registrationDate: registrationDate || null,
      driverId: driverId || null,
      passenger1Id: passenger1Id || null,
      passenger2Id: passenger2Id || null,
      operationStartDate: opStart || null,
      initialMileage: initialMileage ? Number(initialMileage) : null,
    };
    if (isEdit) body.status = status;
    await onSubmit(body);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-2 sm:px-4" onClick={onCancel}>
      {/* 사용자 요청 2026-04-29: 모달 폭 화면 가득 (이전 540px 고정 → max-w-2xl, mobile full width) */}
      <div className="w-full max-w-2xl bg-surface rounded-xl shadow-modal max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-accent">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-ink">{isEdit ? '차량 수정' : '차량 등록'}</h3>
            {isEdit && <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">#{initial.id} · {initial.vehicleNo}</div>}
          </div>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink text-2xl font-bold leading-none px-2">&times;</button>
        </header>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="차량번호 *" hint={!validNo && vehicleNo ? '형식: 11가1234' : '예: 11가1234'}>
              <input
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="11가1234"
                className={`w-full px-3 py-2 rounded-md border-2 text-sm font-mono font-bold focus:outline-none ${
                  vehicleNo && !validNo ? 'border-danger' : 'border-line focus:border-accent'
                }`}
              />
            </Field>
            <Field label="톤수 (라벨)">
              <input
                value={vehicleTon}
                onChange={(e) => setVehicleTon(e.target.value)}
                placeholder="4.5t"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="차종 *">
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleFormPayload['vehicleType'])} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                {VEHICLE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <Field label="연료 *">
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value as VehicleFormPayload['fuelType'])} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="DIESEL">경유</option>
                <option value="LPG">LPG</option>
                <option value="GASOLINE">휘발유</option>
                <option value="ELECTRIC">전기</option>
                <option value="CNG">CNG</option>
              </select>
            </Field>
            <Field label="적재용량 (톤)">
              <input
                type="number"
                step="0.1"
                value={capacityTon}
                onChange={(e) => setCapacityTon(e.target.value)}
                placeholder="4.5"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="연식">
              <input
                type="number"
                value={yearManufactured}
                onChange={(e) => setYearManufactured(e.target.value)}
                placeholder="2024"
                min={1990}
                max={2099}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="등록일자">
              <input
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            {isEdit && (
              <Field label="가동 상태">
                <select value={status} onChange={(e) => setStatus(e.target.value as VehicleFormPayload['status'])} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                  <option value="ACTIVE">정상 운행</option>
                  <option value="MAINTENANCE">정비중</option>
                </select>
              </Field>
            )}
            <Field label="운전자" hint="본인 위탁업체 소속 근로자">
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="">— 미지정 —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </Field>
            <Field label="동승자 1">
              <select value={passenger1Id} onChange={(e) => setPassenger1Id(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="">— 미지정 —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === driverId || w.id === passenger2Id}>
                    {w.name}{(w.id === driverId || w.id === passenger2Id) ? ' (선택됨)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="동승자 2">
              <select value={passenger2Id} onChange={(e) => setPassenger2Id(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="">— 미지정 —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === driverId || w.id === passenger1Id}>
                    {w.name}{(w.id === driverId || w.id === passenger1Id) ? ' (선택됨)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="운행 시작일">
              <input
                type="date"
                value={opStart}
                onChange={(e) => setOpStart(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="주행거리 (km)" hint={isEdit ? '변경 시 누적주행거리도 자동 재계산' : '등록 시점 odometer'}>
              <input
                type="number"
                value={initialMileage}
                onChange={(e) => setInitialMileage(e.target.value)}
                placeholder="12000"
                min={0}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            {isEdit && (
              <Field label="누적주행거리 (km, 자동)" hint="운행일지 승인 시 자동 누적">
                <div className="px-3 py-2 rounded-md border-2 border-line bg-surface-alt text-sm font-mono font-extrabold text-accent">
                  {initial.totalMileage != null ? `${initial.totalMileage.toLocaleString()} km` : '—'}
                </div>
              </Field>
            )}
          </div>
        </div>

        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex items-center justify-end gap-2">
          {hasDuplicateCrew && (
            <span className="text-xs font-extrabold text-danger mr-auto">⚠ 운전자/동승자 1/2는 모두 다른 사람이어야 합니다</span>
          )}
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-danger text-danger text-sm font-extrabold hover:bg-danger hover:text-white disabled:opacity-50 mr-auto"
            >
              삭제
            </button>
          )}
          {errorMsg && (
            <div className="flex-1 text-sm font-bold text-danger bg-red-50 border border-red-200 rounded-md px-3 py-1.5 mr-2">
              {errorMsg}
            </div>
          )}
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button onClick={handleSave} disabled={!canSubmit} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : isEdit ? '저장' : '등록'}
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
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[0.6875rem] font-extrabold text-ink mb-1.5 tracking-wide'} />;
}

function RetireModal({
  vehicle,
  onCancel,
  onSubmit,
}: {
  vehicle: VehicleRow;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-[440px] bg-surface rounded-xl shadow-modal" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-red-50 border-b-2 border-danger">
          <h3 className="text-base font-extrabold text-danger">⚠ 차량 폐차</h3>
          <div className="text-[0.6875rem] font-mono font-bold text-danger mt-0.5">{vehicle.vehicleNo} · {vehicle.vehicleType}</div>
        </header>
        <div className="p-5">
          <p className="text-xs font-semibold text-ink mb-3 leading-relaxed">
            폐차 처리하면 이 차량은 신규 운행일지 작성이 차단됩니다 (기존 데이터는 보존). 이 작업은 audit_log에 영구 보존됩니다.
          </p>
          <label className="block text-xs font-extrabold text-ink mb-2">폐차 사유 (필수)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 노후화로 인한 폐차 / 사고 후 회복 불가"
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-danger resize-none"
          />
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button
            onClick={() => onSubmit(reason.trim())}
            disabled={reason.trim().length < 2}
            className="px-4 py-2 rounded-md bg-danger text-white text-sm font-extrabold hover:bg-red-700 disabled:opacity-50"
          >
            폐차 처리
          </button>
        </footer>
      </div>
    </div>
  );
}

function translateError(code?: string): string | null {
  switch (code) {
    case 'duplicate_vehicle_no': return '같은 차량번호가 이미 등록되어 있습니다.';
    case 'forbidden': return '권한이 없습니다.';
    case 'invalid_request': return '입력값이 올바르지 않습니다 (차량번호 형식 확인).';
    case 'invalid_driver_or_passenger': return '운전자/동승자가 올바르지 않습니다. 같은 업체 소속 현장 근로자만 지정할 수 있습니다.';
    case 'duplicate_crew_member': return '운전자와 동승자에 동일 인원이 중복 지정되었습니다.';
    case 'contractor_id_required': return '위탁업체를 선택해 주세요.';
    case 'no_contractor': return '소속 위탁업체가 지정되지 않았습니다.';
    case 'not_found': return '차량을 찾을 수 없습니다.';
    case 'already_retired': return '이미 폐차 처리된 차량입니다.';
    case 'has_active_logs': return '진행 중인 운행일지가 있어 삭제할 수 없습니다.';
    case 'db_error': return null; // message 필드에 상세 메시지가 있음
    default: return null;
  }
}

function DeleteVehicleModal({
  vehicle,
  onCancel,
  onSubmit,
}: {
  vehicle: VehicleRow;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(translateError(data?.error) ?? data?.message ?? '삭제 실패');
        return;
      }
      await onSubmit();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-[440px] bg-surface rounded-xl shadow-modal" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-red-50 border-b-2 border-danger">
          <h3 className="text-base font-extrabold text-danger">⚠ 차량 삭제</h3>
          <div className="text-[0.6875rem] font-mono font-bold text-danger mt-0.5">{vehicle.vehicleNo} · {vehicle.vehicleType}</div>
        </header>
        <div className="p-5">
          <p className="text-xs font-semibold text-ink mb-3 leading-relaxed">
            차량과 관련된 모든 데이터(운행일지 등)가 영구 삭제됩니다. 진행 중인 운행일지가 있으면 삭제할 수 없습니다.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-800 mb-2">{error}</div>
          )}
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-danger text-white text-sm font-extrabold hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? '삭제 중…' : '삭제'}
          </button>
        </footer>
      </div>
    </div>
  );
}

type LogDetail = {
  passengers?: string;
  operationPeriod?: string;
  fuelCost?: number;
  fuelUsed?: number;
  ureaUsed?: number;
  ureaCost?: number;
  inspection?: Record<string, string>;
  maintenance?: { company?: string; content?: string; cost?: number };
  bagWork?: Array<Record<string, string | number | null>>;
  bagMachineWork?: Record<string, number>;
  largeWasteWork?: Record<string, number>;
  note?: string;
};

function VehicleOperationDetailTable({ routeDetail }: { routeDetail: string | null }) {
  const rows: Array<{ round: string; start: string; end: string; zone: string; note: string }> = [];

  if (routeDetail) {
    try {
      const d = JSON.parse(routeDetail) as {
        operationRows?: Array<{ startTime: string; endTime: string; zone: string; note: string }>;
        operationPeriod?: string;
      };
      if (Array.isArray(d.operationRows) && d.operationRows.length > 0) {
        for (const [i, r] of d.operationRows.entries()) {
          rows.push({ round: `${i + 1}회`, start: r.startTime ?? '', end: r.endTime ?? '', zone: r.zone ?? '', note: r.note ?? '' });
        }
      } else if (d.operationPeriod) {
        const parts = d.operationPeriod.split(';').map((s: string) => s.trim()).filter(Boolean);
        for (const part of parts) {
          const m = part.match(/^(\d+차)\s+(.+)$/);
          if (m) {
            const timePart = m[2];
            const timem = timePart.match(/^([\d:]+)[-–]([\d:]+)(.*)$/);
            if (timem) {
              rows.push({ round: m[1], start: timem[1], end: timem[2], zone: timem[3].trim(), note: '' });
            } else {
              rows.push({ round: m[1], start: timePart, end: '', zone: '', note: '' });
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  while (rows.length < 6) {
    rows.push({ round: `${rows.length + 1}회`, start: '', end: '', zone: '', note: '' });
  }

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
      <div className="font-extrabold text-slate-700 mb-1 text-[0.6875rem] flex items-center gap-2">
        <span>◎ 차량운행내역</span>
        <span className="font-normal text-red-600 text-[0.625rem]">※지정 소각장 및 기타처리장 반입 상황에 따라 근무시간 조정.</span>
      </div>
      <table className="border-collapse text-[0.6875rem] w-full">
        <thead>
          <tr>
            <th className="border border-slate-400 w-8 py-0.5 bg-slate-200"></th>
            <th className="border border-slate-400 px-2 py-0.5 font-bold text-center bg-slate-200">시작시간</th>
            <th className="border border-slate-400 px-2 py-0.5 font-bold text-center bg-slate-200">종료시간</th>
            <th className="border border-slate-400 px-4 py-0.5 font-bold text-center bg-slate-200">작 업 구 간</th>
            <th className="border border-slate-400 px-4 py-0.5 font-bold text-center bg-slate-200">비 고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border border-slate-400 px-1 py-1 text-center font-bold bg-slate-100">{r.round}</td>
              <td className="border border-slate-400 px-2 py-1 text-center font-mono min-w-[60px]">{r.start || <span className="text-slate-300">:</span>}</td>
              <td className="border border-slate-400 px-2 py-1 text-center font-mono min-w-[60px]">{r.end || <span className="text-slate-300">:</span>}</td>
              <td className="border border-slate-400 px-2 py-1 min-w-[120px]">{r.zone}</td>
              <td className="border border-slate-400 px-2 py-1 min-w-[80px]">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehicleLogDetail({ routeDetail, startMileage, endMileage }: { routeDetail: string | null; startMileage: number | null; endMileage: number | null }) {
  let detail: LogDetail | null = null;
  if (routeDetail) {
    try { detail = JSON.parse(routeDetail) as LogDetail; } catch { /* plain text */ }
  }

  if (!detail && !routeDetail) {
    return <div className="text-xs text-ink-muted">상세 정보 없음</div>;
  }

  const inspection = detail?.inspection;
  const maint = detail?.maintenance;
  const bagWork = Array.isArray(detail?.bagWork) ? detail.bagWork : null;
  const bagMachineWork = detail?.bagMachineWork && typeof detail.bagMachineWork === 'object' ? detail.bagMachineWork : null;
  const largeWasteWork = detail?.largeWasteWork && typeof detail.largeWasteWork === 'object' ? detail.largeWasteWork : null;

  return (
    <div className="text-xs space-y-2">
      {/* 기본 운행 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {startMileage != null && endMileage != null && (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">주행거리</div>
            <div className="font-extrabold">{(endMileage - startMileage).toLocaleString()} km</div>
            <div className="text-[0.625rem] text-ink-muted">{startMileage.toLocaleString()} → {endMileage.toLocaleString()}</div>
          </div>
        )}
        {detail?.passengers ? (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">동승 수거원</div>
            <div className="font-semibold">{detail.passengers}</div>
          </div>
        ) : null}
        {detail?.operationPeriod ? (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">운행시간</div>
            <div className="font-semibold">{detail.operationPeriod}</div>
          </div>
        ) : null}
        {detail?.fuelCost != null && detail.fuelCost > 0 ? (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">연료비</div>
            <div className="font-semibold">{Number(detail.fuelCost).toLocaleString()} 원</div>
          </div>
        ) : null}
      </div>

      {/* 작업내역 A */}
      {bagWork && bagWork.length > 0 && bagWork.some((r) => Number(r.general) > 0 || Number(r.food) > 0 || Number(r.recycle) > 0) && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
          <div className="font-extrabold text-blue-900 mb-1">작업내역 A — 중량제봉투·음식물·재활 (kg)</div>
          <table className="w-full border-collapse text-[0.6875rem]">
            <thead><tr className="text-blue-700">
              <th className="text-left pr-2 pb-0.5 font-extrabold">회차</th>
              <th className="pr-2 pb-0.5 font-extrabold">일반</th>
              <th className="pr-2 pb-0.5 font-extrabold">음식물</th>
              <th className="pr-2 pb-0.5 font-extrabold">재활용</th>
              <th className="text-left pb-0.5 font-extrabold">반입장소</th>
              <th className="text-left pb-0.5 font-extrabold">비고</th>
            </tr></thead>
            <tbody>
              {bagWork.map((row, i) => (
                <tr key={i} className="font-mono">
                  <td className="pr-2 py-0.5 text-blue-700">{i + 1}회</td>
                  <td className="pr-2 py-0.5 text-center">{row.general || '—'}</td>
                  <td className="pr-2 py-0.5 text-center">{row.food || '—'}</td>
                  <td className="pr-2 py-0.5 text-center">{row.recycle || '—'}</td>
                  <td className="py-0.5 pr-2">{(row.disposalSite as string) || '—'}</td>
                  <td className="py-0.5">{(row.note as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 작업내역 B */}
      {bagMachineWork && Object.values(bagMachineWork).some((v) => Number(v) > 0) && (
        <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-200">
          <div className="font-extrabold text-green-900 mb-1">작업내역 B — 중량계·봉투 수거 (L)</div>
          <div className="font-mono grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.6875rem]">
            {Object.entries(bagMachineWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{BAG_MACHINE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {/* 작업내역 C */}
      {largeWasteWork && Object.values(largeWasteWork).some((v) => Number(v) > 0) && (
        <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          <div className="font-extrabold text-amber-900 mb-1">작업내역 C — 대형폐기물 (점)</div>
          <div className="font-mono grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.6875rem]">
            {Object.entries(largeWasteWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{LARGE_WASTE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {/* 차량 점검 */}
      {inspection && Object.keys(inspection).length > 0 && (
        <div>
          <div className="text-[0.625rem] font-extrabold text-ink-muted mb-1">차량 점검</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(inspection).map(([key, val]) => (
              <span key={key} className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold border ${
                val === '양호' || val === '예' ? 'bg-green-50 border-green-300 text-green-800' :
                val === '이상' ? 'bg-red-50 border-red-300 text-red-700' :
                'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                {INSPECTION_KEY_LABEL[key] ?? key}: {val}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 정비 이력 */}
      {maint && (maint.company || maint.content) && (
        <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          <div className="text-[0.625rem] font-extrabold text-amber-900 mb-0.5">정비 이력</div>
          {maint.company ? <div className="text-ink">업체: {maint.company}</div> : null}
          {maint.content ? <div className="text-ink">내용: {maint.content}</div> : null}
          {maint.cost ? <div className="text-ink">비용: {maint.cost.toLocaleString()} 원</div> : null}
        </div>
      )}

      {/* 차량운행내역 */}
      <VehicleOperationDetailTable routeDetail={routeDetail} />

      {detail?.note ? (
        <div className="text-ink-muted italic">특이사항: {detail.note}</div>
      ) : null}
      {!detail && routeDetail ? (
        <pre className="text-[0.6875rem] font-mono whitespace-pre-wrap break-all text-ink-muted">{routeDetail}</pre>
      ) : null}
    </div>
  );
}

function RejectModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-[440px] bg-surface rounded-xl shadow-modal" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line">
          <h3 className="text-base font-extrabold text-ink">운행일지 반려</h3>
        </header>
        <div className="p-5">
          <label className="block text-xs font-extrabold text-ink mb-2">반려 사유</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 주행거리 입력 누락 / 수거량과 운행횟수 불일치"
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
          />
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button
            onClick={() => onSubmit(reason.trim())}
            disabled={reason.trim().length < 2}
            className="px-4 py-2 rounded-md bg-danger text-white text-sm font-extrabold hover:bg-red-700 disabled:opacity-50"
          >
            반려 처리
          </button>
        </footer>
      </div>
    </div>
  );
}
