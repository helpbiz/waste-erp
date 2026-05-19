'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

type ParsedRouteDetail = {
  passengers?: string;
  operationPeriod?: string;
  fuelCost?: number;
  fuelUsed?: number;
  ureaUsed?: number;
  ureaCost?: number;
  note?: string;
  bagWork?: Array<Record<string, string | number | null>>;
  bagMachineWork?: Record<string, number>;
  largeWasteWork?: Record<string, number>;
  inspection?: Record<string, string>;
  maintenance?: { company?: string; content?: string; cost?: number };
};

function PrintRouteDetail({ raw }: { raw: string }) {
  let d: ParsedRouteDetail | null = null;
  try { d = JSON.parse(raw) as ParsedRouteDetail; } catch { /* plain text fallback */ }

  if (!d) {
    return <div className="text-sm whitespace-pre-wrap">{raw}</div>;
  }

  const bagWork = Array.isArray(d.bagWork) ? d.bagWork : null;
  const bagMachineWork = d.bagMachineWork && Object.values(d.bagMachineWork).some((v) => Number(v) > 0) ? d.bagMachineWork : null;
  const largeWasteWork = d.largeWasteWork && Object.values(d.largeWasteWork).some((v) => Number(v) > 0) ? d.largeWasteWork : null;
  const inspection = d.inspection;
  const maint = d.maintenance;

  return (
    <div className="space-y-2 text-sm">
      {/* 운행 기본 */}
      {(d.passengers || d.operationPeriod || d.fuelCost || d.fuelUsed || d.note) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {d.passengers && <div><span className="font-bold">동승자:</span> {d.passengers}</div>}
          {d.operationPeriod && <div><span className="font-bold">운행시간:</span> {d.operationPeriod}</div>}
          {d.fuelUsed != null && Number(d.fuelUsed) > 0 && <div><span className="font-bold">주유량:</span> {d.fuelUsed}L</div>}
          {d.fuelCost != null && Number(d.fuelCost) > 0 && <div><span className="font-bold">주유금액:</span> {Number(d.fuelCost).toLocaleString()}원</div>}
          {d.ureaUsed != null && Number(d.ureaUsed) > 0 && <div><span className="font-bold">요소수:</span> {d.ureaUsed}L</div>}
          {d.note && <div className="col-span-2"><span className="font-bold">특이사항:</span> {d.note}</div>}
        </div>
      )}

      {/* 작업내역 A */}
      {bagWork && bagWork.some((r) => Number(r.general) > 0 || Number(r.food) > 0 || Number(r.recycle) > 0) && (
        <div>
          <div className="font-bold text-xs mb-0.5">작업내역 A — 중량제봉투·음식물·재활 (kg)</div>
          <table className="border-collapse text-xs w-full">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-0.5 font-bold text-left">회차</th>
                <th className="border border-slate-300 px-2 py-0.5 font-bold">일반(kg)</th>
                <th className="border border-slate-300 px-2 py-0.5 font-bold">음식물(kg)</th>
                <th className="border border-slate-300 px-2 py-0.5 font-bold">재활용(kg)</th>
                <th className="border border-slate-300 px-2 py-0.5 font-bold text-left">반입장소</th>
                <th className="border border-slate-300 px-2 py-0.5 font-bold text-left">비고</th>
              </tr>
            </thead>
            <tbody>
              {bagWork.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-0.5">{i + 1}회</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{row.general || '—'}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{row.food || '—'}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{row.recycle || '—'}</td>
                  <td className="border border-slate-300 px-2 py-0.5">{(row.disposalSite as string) || '—'}</td>
                  <td className="border border-slate-300 px-2 py-0.5">{(row.note as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 작업내역 B */}
      {bagMachineWork && (
        <div>
          <div className="font-bold text-xs mb-0.5">작업내역 B — 중량계·봉투 수거 (L)</div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
            {Object.entries(bagMachineWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{BAG_MACHINE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {/* 작업내역 C */}
      {largeWasteWork && (
        <div>
          <div className="font-bold text-xs mb-0.5">작업내역 C — 대형폐기물 (점)</div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
            {Object.entries(largeWasteWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{LARGE_WASTE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {/* 차량 점검 */}
      {inspection && Object.keys(inspection).length > 0 && (
        <div>
          <div className="font-bold text-xs mb-0.5">차량 점검</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {Object.entries(inspection).map(([k, v]) => (
              <span key={k} className={v === '이상' || v === '수리점검' || v === '아니오' ? 'font-bold text-red-700' : ''}>
                {INSPECTION_KEY_LABEL[k] ?? k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 정비 이력 */}
      {maint && (maint.company || maint.content) && (
        <div>
          <div className="font-bold text-xs mb-0.5">정비 이력</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {maint.company && <span><span className="font-bold">업체:</span> {maint.company}</span>}
            {maint.content && <span><span className="font-bold">내용:</span> {maint.content}</span>}
            {maint.cost ? <span><span className="font-bold">비용:</span> {maint.cost.toLocaleString()}원</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}

type Log = {
  id: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleTon: string | null;
  contractorName: string | null;
  driverName: string;
  driverEmployeeNo: string | null;
  zoneName: string | null;
  startMileage: number | null;
  endMileage: number | null;
  fuelUsed: number | null;
  wasteWeightKg: number | null;
  tripCount: number | null;
  routeDetail: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = { DRAFT: '작성중', SUBMITTED: '제출', APPROVED: '승인', REJECTED: '반려' };

function VehicleOperationTable({ routeDetail }: { routeDetail: string | null }) {
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
    <table className="border-collapse text-xs w-full mt-1">
      <thead>
        <tr>
          <th className="border border-slate-500 w-8 py-0.5" style={{ background: 'repeating-linear-gradient(-45deg,#e2e8f0,#e2e8f0 2px,#f8fafc 2px,#f8fafc 6px)' }}></th>
          <th className="border border-slate-500 px-2 py-0.5 font-bold text-center">시작시간</th>
          <th className="border border-slate-500 px-2 py-0.5 font-bold text-center">종료시간</th>
          <th className="border border-slate-500 px-4 py-0.5 font-bold text-center">작&nbsp;&nbsp;업&nbsp;&nbsp;구&nbsp;&nbsp;간</th>
          <th className="border border-slate-500 px-4 py-0.5 font-bold text-center">비&nbsp;&nbsp;고</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="border border-slate-500 px-1 py-1 text-center font-bold text-[11px]">{r.round}</td>
            <td className="border border-slate-500 px-2 py-1 text-center font-mono min-w-[60px]">{r.start ? r.start : <span className="text-slate-300">  :  </span>}</td>
            <td className="border border-slate-500 px-2 py-1 text-center font-mono min-w-[60px]">{r.end ? r.end : <span className="text-slate-300">  :  </span>}</td>
            <td className="border border-slate-500 px-2 py-1 min-w-[120px]">{r.zone}</td>
            <td className="border border-slate-500 px-2 py-1 min-w-[80px]">{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function VehiclePrintClient({
  date, selectedVehicleId, vehicles, logs, isSuperAdmin = false,
}: {
  date: string;
  selectedVehicleId: string | null;
  vehicles: Array<{ id: string; vehicleNo: string; type: string }>;
  logs: Log[];
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);
  const [vehicleId, setVehicleId] = useState(selectedVehicleId ?? '');

  function navigate() {
    const params = new URLSearchParams({ date: selectedDate });
    if (vehicleId) params.set('vehicleId', vehicleId);
    router.push(`/vehicles/print?${params}`);
  }

  function printNow() { if (typeof window !== 'undefined') window.print(); }

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">날짜</div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">대상</div>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold min-w-[200px]">
            <option value="">전체 차량 (일괄 출력)</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo} ({v.type})</option>)}
          </select>
        </div>
        <button onClick={navigate}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
          조회
        </button>
        <button onClick={printNow}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          🖨 인쇄
        </button>
        <a
          href={`/api/vehicle-logs/export?from=${selectedDate}&to=${selectedDate}`}
          download={`차량운행일지_${selectedDate}.xlsx`}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700"
        >
          📥 Excel
        </a>
        <a href="/vehicles" className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-line hover:bg-slate-50">← 차량관리</a>
        {logs.length >= 30 && (
          <div className="w-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-3 py-1.5 mt-2">
            ⚠ 최대 30건까지 표시됩니다. 날짜 또는 차량을 좁혀 조회하세요.
          </div>
        )}
      </div>

      {/* 인쇄 영역 */}
      <div className="bg-white print:bg-white">
        <div className="border-t-4 border-double border-slate-700 pt-3 px-2">
          <h1 className="text-2xl font-black text-center mb-1">차량 운행일지</h1>
          <div className="text-center text-sm font-bold text-slate-600 mb-4">
            {selectedDate} {vehicleId && logs[0] ? `· ${logs[0].vehicleNo}` : '· 일괄 출력'}
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-600">해당 날짜의 운행일지가 없습니다.</div>
          ) : (
            <div>
              {logs.map((l, idx) => {
                let passengers: string | null = null;
                if (l.routeDetail) {
                  try { const _d = JSON.parse(l.routeDetail) as { passengers?: string }; if (_d.passengers) passengers = _d.passengers; } catch { /* ignore */ }
                }
                return (
                <article key={l.id} className={`border-2 border-slate-700 mb-6${idx > 0 ? ' print-page-break' : ''}`}>
                  {/* 헤더 */}
                  <header className="bg-slate-100 border-b border-slate-700 px-3 py-2 grid grid-cols-4 gap-2 text-sm">
                    <div><span className="font-bold">차량번호:</span> {l.vehicleNo}</div>
                    <div><span className="font-bold">차종:</span> {l.vehicleType} {l.vehicleTon ? `(${l.vehicleTon})` : ''}</div>
                    <div><span className="font-bold">위탁업체:</span> {l.contractorName ?? '—'}</div>
                    <div><span className="font-bold">상태:</span> {STATUS_LABEL[l.status] ?? l.status}</div>
                  </header>
                  <div className="px-3 py-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm border-b border-slate-300">
                    <div><span className="font-bold">운전자:</span> {l.driverName} ({l.driverEmployeeNo ?? '—'})</div>
                    {isSuperAdmin ? (
                      <>
                        <div><span className="font-bold">청소구역:</span> {l.zoneName ?? '—'}</div>
                        <div><span className="font-bold">운행 횟수:</span> {l.tripCount ?? '—'}회</div>
                      </>
                    ) : (
                      <>
                        <div></div>
                        <div></div>
                      </>
                    )}
                    <div><span className="font-bold">시작 누적:</span> {l.startMileage?.toLocaleString() ?? '—'} km</div>
                    <div><span className="font-bold">종료 누적:</span> {l.endMileage?.toLocaleString() ?? '—'} km</div>
                    <div><span className="font-bold">주행 거리:</span> {(l.startMileage != null && l.endMileage != null) ? `${(l.endMileage - l.startMileage).toLocaleString()} km` : '—'}</div>
                    <div><span className="font-bold">연료 사용:</span> {l.fuelUsed != null ? `${l.fuelUsed.toFixed(2)} L` : '—'}</div>
                    <div><span className="font-bold">수거량:</span> {l.wasteWeightKg != null ? `${l.wasteWeightKg.toLocaleString()} kg` : '—'}</div>
                    {passengers ? <div><span className="font-bold">동승자:</span> {passengers}</div> : <div></div>}
                  </div>
                  <div className="px-3 py-2 border-b border-slate-300">
                    <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-2">
                      <span>◎ 차량운행내역</span>
                      <span className="font-normal text-red-700 text-[10px]">※지정 소각장 및 기타처리장 반입 상황에 따라 근무시간 조정.</span>
                    </div>
                    <VehicleOperationTable routeDetail={l.routeDetail} />
                  </div>
                  {l.routeDetail && (() => {
                    let d: ParsedRouteDetail | null = null;
                    try { d = JSON.parse(l.routeDetail) as ParsedRouteDetail; } catch { /* skip */ }
                    const hasBagWork = Array.isArray(d?.bagWork) && d.bagWork.some((r) => Number(r.general) > 0 || Number(r.food) > 0 || Number(r.recycle) > 0);
                    const hasBagMachine = d?.bagMachineWork && Object.values(d.bagMachineWork).some((v) => Number(v) > 0);
                    const hasLargeWaste = d?.largeWasteWork && Object.values(d.largeWasteWork).some((v) => Number(v) > 0);
                    const hasInspection = d?.inspection && Object.keys(d.inspection).length > 0;
                    const hasMaint = d?.maintenance && (d.maintenance.company || d.maintenance.content);
                    if (!hasBagWork && !hasBagMachine && !hasLargeWaste && !hasInspection && !hasMaint) return null;
                    return (
                      <div className="px-3 py-2 border-b border-slate-300">
                        <PrintRouteDetail raw={l.routeDetail} />
                      </div>
                    );
                  })()}
                  {/* 결재란 — 사용자 요청 2026-04-29: 모든 보고서 결재란 숨김 */}
                  <div className="text-[10px] font-mono text-slate-600 px-3 py-1 text-right">#{idx + 1} / {logs.length}</div>
                </article>
                );
              })}
            </div>
          )}

          <div className="mt-6 text-center text-[10px] font-mono text-slate-600">
            출력일시: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          .print-page-break { break-before: page; page-break-before: always; }
        }
      `}</style>
    </div>
  );
}
