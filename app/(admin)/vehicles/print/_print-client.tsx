'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function VehiclePrintClient({
  date, selectedVehicleId, vehicles, logs,
}: {
  date: string;
  selectedVehicleId: string | null;
  vehicles: Array<{ id: string; vehicleNo: string; type: string }>;
  logs: Log[];
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
        <a href="/vehicles" className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-line hover:bg-slate-50">← 차량관리</a>
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
            <div className="space-y-6">
              {logs.map((l, idx) => (
                <article key={l.id} className="border-2 border-slate-700 page-break-inside-avoid">
                  {/* 헤더 */}
                  <header className="bg-slate-100 border-b border-slate-700 px-3 py-2 grid grid-cols-4 gap-2 text-sm">
                    <div><span className="font-bold">차량번호:</span> {l.vehicleNo}</div>
                    <div><span className="font-bold">차종:</span> {l.vehicleType} {l.vehicleTon ? `(${l.vehicleTon})` : ''}</div>
                    <div><span className="font-bold">위탁업체:</span> {l.contractorName ?? '—'}</div>
                    <div><span className="font-bold">상태:</span> {STATUS_LABEL[l.status] ?? l.status}</div>
                  </header>
                  <div className="px-3 py-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm border-b border-slate-300">
                    <div><span className="font-bold">운전자:</span> {l.driverName} ({l.driverEmployeeNo ?? '—'})</div>
                    <div><span className="font-bold">청소구역:</span> {l.zoneName ?? '—'}</div>
                    <div><span className="font-bold">운행 횟수:</span> {l.tripCount ?? '—'}회</div>
                    <div><span className="font-bold">시작 누적:</span> {l.startMileage?.toLocaleString() ?? '—'} km</div>
                    <div><span className="font-bold">종료 누적:</span> {l.endMileage?.toLocaleString() ?? '—'} km</div>
                    <div><span className="font-bold">주행 거리:</span> {(l.startMileage != null && l.endMileage != null) ? `${(l.endMileage - l.startMileage).toLocaleString()} km` : '—'}</div>
                    <div><span className="font-bold">연료 사용:</span> {l.fuelUsed != null ? `${l.fuelUsed.toFixed(2)} L` : '—'}</div>
                    <div><span className="font-bold">수거량:</span> {l.wasteWeightKg != null ? `${l.wasteWeightKg.toLocaleString()} kg` : '—'}</div>
                    <div></div>
                  </div>
                  {l.routeDetail && (
                    <div className="px-3 py-2 border-b border-slate-300">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">운행 경로 / 비고</div>
                      <div className="text-sm whitespace-pre-wrap">{l.routeDetail}</div>
                    </div>
                  )}
                  {/* 결재란 — 사용자 요청 2026-04-29: 모든 보고서 결재란 숨김 */}
                  <div className="text-[10px] font-mono text-slate-600 px-3 py-1 text-right">#{idx + 1} / {logs.length}</div>
                </article>
              ))}
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
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
