'use client';

import React, { useState, useEffect } from 'react';
import { todayLocalStr, thisMonthLocalStr } from '@/lib/dates';

type LogItem = {
  id: string;
  logDate: string;
  status: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleTon: string | null;
  driverName: string;
  zoneName: string | null;
  startMileage: number | null;
  endMileage: number | null;
  fuelUsed: number | null;
  wasteWeightKg: number | null;
  tripCount: number | null;
  routeDetail: string | null;
};

type SummaryData = {
  total: number;
  page: number;
  limit: number;
  statusCounts: { DRAFT: number; SUBMITTED: number; APPROVED: number };
  items: LogItem[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중', SUBMITTED: '제출됨', APPROVED: '승인완료',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
};

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

function LogDetail({ item }: { item: LogItem }) {
  let d: Record<string, unknown> = {};
  if (item.routeDetail) {
    try { d = JSON.parse(item.routeDetail) as Record<string, unknown>; } catch { /* plain text */ }
  }

  const passengers = typeof d.passengers === 'string' ? d.passengers : null;
  const note = typeof d.note === 'string' ? d.note : null;
  const bagWork = Array.isArray(d.bagWork) ? (d.bagWork as Record<string, string>[]) : null;
  const bagMachineWork = d.bagMachineWork && typeof d.bagMachineWork === 'object' ? (d.bagMachineWork as Record<string, string>) : null;
  const largeWasteWork = d.largeWasteWork && typeof d.largeWasteWork === 'object' ? (d.largeWasteWork as Record<string, string>) : null;
  const inspection = d.inspection && typeof d.inspection === 'object' ? (d.inspection as Record<string, string>) : null;
  const operationPeriod = typeof d.operationPeriod === 'string' ? d.operationPeriod : null;

  return (
    <div className="text-xs space-y-2 pt-1">
      {/* 기본 수치 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {item.startMileage != null && item.endMileage != null && (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">주행거리</div>
            <div className="font-extrabold">{(item.endMileage - item.startMileage).toLocaleString()} km</div>
            <div className="text-[0.625rem] text-ink-muted">{item.startMileage.toLocaleString()} → {item.endMileage.toLocaleString()}</div>
          </div>
        )}
        {item.fuelUsed != null && (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">주유량</div>
            <div className="font-extrabold">{Number(item.fuelUsed).toFixed(1)} L</div>
          </div>
        )}
        {item.wasteWeightKg != null && (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">수거량</div>
            <div className="font-extrabold">{item.wasteWeightKg.toLocaleString()} kg</div>
          </div>
        )}
        {item.tripCount != null && (
          <div className="bg-white border border-line rounded px-2 py-1.5">
            <div className="text-[0.625rem] font-bold text-ink-muted">운행횟수</div>
            <div className="font-extrabold">{item.tripCount} 회</div>
          </div>
        )}
      </div>

      {/* routeDetail 기타 정보 */}
      {(passengers || operationPeriod || note) && (
        <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-0.5 border border-line">
          {passengers && <div className="font-mono">동승자: {passengers}</div>}
          {operationPeriod && <div className="font-mono">운행시간: {operationPeriod}</div>}
          {note && <div className="font-mono whitespace-pre-wrap">특이사항: {note}</div>}
        </div>
      )}

      {/* 작업내역 A */}
      {bagWork && bagWork.length > 0 && bagWork.some(r => Number(r.general) > 0 || Number(r.food) > 0 || Number(r.recycle) > 0) && (
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
                  <td className="py-0.5 pr-2">{row.disposalSite || '—'}</td>
                  <td className="py-0.5">{row.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 작업내역 B */}
      {bagMachineWork && Object.values(bagMachineWork).some(v => Number(v) > 0) && (
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
      {largeWasteWork && Object.values(largeWasteWork).some(v => Number(v) > 0) && (
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

      {!item.routeDetail && !item.startMileage && !item.fuelUsed && (
        <div className="text-ink-muted">상세 정보 없음</div>
      )}
    </div>
  );
}

const thisMonth = () => thisMonthLocalStr();
const today = () => todayLocalStr();

export default function LogsOverviewClient() {
  const [from, setFrom] = useState(thisMonth() + '-01');
  const [to, setTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load(p = 1) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to, page: String(p), limit: '50' });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/vehicle-logs/summary?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); setPage(p); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <a href="/vehicles" className="text-xs font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-white">
          ← 차량관리
        </a>
        <h2 className="text-xl font-black text-ink tracking-tight">차량일지 현황</h2>
      </div>

      {/* 상태 요약 카드 */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {(['DRAFT', 'SUBMITTED', 'APPROVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setTimeout(() => load(1), 0); }}
              className={`rounded-xl border p-4 text-center transition hover:shadow-md ${
                statusFilter === s ? 'ring-2 ring-accent border-accent' : 'border-line bg-surface'
              }`}
            >
              <div className="text-[10px] font-mono font-extrabold text-slate-500 mb-1">{STATUS_LABEL[s]}</div>
              <div className="text-2xl font-black text-ink">{data.statusCounts[s]}</div>
            </button>
          ))}
        </div>
      )}

      {/* 필터 */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono" />
        </div>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono" />
        </div>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">상태</div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold">
            <option value="">전체</option>
            <option value="DRAFT">작성중</option>
            <option value="SUBMITTED">제출됨</option>
            <option value="APPROVED">승인완료</option>
          </select>
        </div>
        <button onClick={() => load(1)}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
          조회
        </button>
        {data && (
          <span className="ml-auto text-xs text-ink-muted">총 {data.total}건</span>
        )}
      </div>

      {loading && <div className="py-10 text-center text-slate-500 text-sm">로딩 중…</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">{error}</div>}

      {data && !loading && (
        <>
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            {data.items.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">해당 조건의 차량일지가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '1080px' }}>
                  <colgroup>
                    <col style={{ width: '88px' }} />  {/* 일자 */}
                    <col style={{ width: '96px' }} />  {/* 차량번호 */}
                    <col style={{ width: '72px' }} />  {/* 차종 */}
                    <col style={{ width: '56px' }} />  {/* 톤급 */}
                    <col style={{ width: '72px' }} />  {/* 운전자 */}
                    <col style={{ width: '72px' }} />  {/* 구역 */}
                    <col style={{ width: '76px' }} />  {/* 상태 */}
                    <col style={{ width: '92px' }} />  {/* 시작계기 */}
                    <col style={{ width: '92px' }} />  {/* 종료계기 */}
                    <col style={{ width: '88px' }} />  {/* 주행거리 */}
                    <col style={{ width: '72px' }} />  {/* 주유량 */}
                    <col style={{ width: '80px' }} />  {/* 수거량 */}
                    <col style={{ width: '72px' }} />  {/* 운행횟수 */}
                    <col style={{ width: '56px' }} />  {/* 상세 */}
                  </colgroup>
                  <thead className="bg-slate-50 border-b border-line">
                    <tr>
                      {[
                        '일자', '차량번호', '차종', '톤급', '운전자', '구역', '상태',
                        '시작계기(km)', '종료계기(km)', '주행거리(km)', '주유량(L)', '수거량(kg)', '운행횟수', '상세',
                      ].map((h) => (
                        <th key={h} className="py-2 px-2 text-xs border border-slate-200"
                          style={{ textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((l) => {
                      const driven = l.startMileage != null && l.endMileage != null
                        ? l.endMileage - l.startMileage : null;
                      const tdBase: React.CSSProperties = {
                        border: '1px solid #d9d9d9', padding: '8px',
                        verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', fontSize: '12px',
                      };
                      const tdC: React.CSSProperties = { ...tdBase, textAlign: 'center' };
                      const tdR: React.CSSProperties = { ...tdBase, textAlign: 'right' };
                      return (
                        <React.Fragment key={l.id}>
                          <tr style={{ height: '40px' }}
                            className="transition"
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f9fc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                            <td style={tdC} className="font-mono">{l.logDate}</td>
                            <td style={tdC} className="font-bold">{l.vehicleNo}</td>
                            <td style={tdC}>{l.vehicleType || '—'}</td>
                            <td style={tdC}>{l.vehicleTon || '—'}</td>
                            <td style={tdC}>{l.driverName}</td>
                            <td style={tdC}>{l.zoneName || '—'}</td>
                            <td style={tdC}>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${STATUS_COLOR[l.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABEL[l.status] ?? l.status}
                              </span>
                            </td>
                            <td style={tdR}>{l.startMileage != null ? l.startMileage.toLocaleString() : '—'}</td>
                            <td style={tdR}>{l.endMileage   != null ? l.endMileage.toLocaleString()   : '—'}</td>
                            <td style={tdR}>{driven         != null ? driven.toLocaleString()          : '—'}</td>
                            <td style={tdR}>{l.fuelUsed     != null ? Number(l.fuelUsed).toLocaleString() : '—'}</td>
                            <td style={tdR}>{l.wasteWeightKg != null ? l.wasteWeightKg.toLocaleString() : '—'}</td>
                            <td style={tdR}>{l.tripCount     != null ? l.tripCount.toLocaleString()    : '—'}</td>
                            <td style={tdC}>
                              <button
                                onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                                className="px-2 py-0.5 rounded text-[11px] font-extrabold border border-line hover:bg-surface-soft"
                              >
                                {expandedId === l.id ? '접기' : '상세'}
                              </button>
                            </td>
                          </tr>
                          {expandedId === l.id && (
                            <tr style={{ background: '#f8fafc' }}>
                              <td colSpan={14} style={{ border: '1px solid #d9d9d9', padding: '12px 16px' }}>
                                <LogDetail item={l} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 rounded border border-line text-sm font-bold disabled:opacity-40 hover:bg-surface-soft">
                이전
              </button>
              <span className="px-3 py-1.5 text-sm text-ink-muted">
                {page} / {totalPages}
              </span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 rounded border border-line text-sm font-bold disabled:opacity-40 hover:bg-surface-soft">
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
