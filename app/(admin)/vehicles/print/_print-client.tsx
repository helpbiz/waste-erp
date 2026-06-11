'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKr(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${DOW[d.getDay()]})`;
}

/* ── 작업내역 B: 항목 × 3열 ── */
const BM_ROWS: Array<Array<[string, string]>> = [
  [['food_1L', '음식물 1ℓ'],    ['food_2L', '음식물 2ℓ'],   ['food_3L', '음식물 3ℓ']],
  [['food_5L', '음식물 5ℓ'],    ['food_10L', '음식물 10ℓ'],  ['living_10L', '일 반 10ℓ']],
  [['living_20L', '일 반 20ℓ'], ['living_30L', '일 반 30ℓ'], ['living_50L', '일 반 50ℓ']],
  [['living_75L', '일 반 75ℓ'], ['reuse_10L', '재사용 10ℓ'], ['reuse_20L', '재사용 20ℓ']],
  [['illegal_20', '무단투기 20ℓ기준'], ['__blank__', ''],    ['special', '특수']],
];

/* ── 작업내역 C: 대형폐기물 (3열 × 3행) ── */
const LW_ROWS: Array<Array<[string, string]>> = [
  [['furniture', '가구류'],  ['bed', '침대류'],        ['household', '생활용품']],
  [['chair', '의자류'],      ['appliance', '가전제품'], ['other', '기타']],
  [['sofa', '쇼파류'],       ['extinguisher', '소화기'],['illegalTotal', '무단투기 총합']],
];

/* ── 차량점검: 2개씩 묶음 × 5행 ── */
const INSP_ROWS: Array<Array<[string, string]>> = [
  [['safetyBar', '안전멈춤Bar'],  ['handSwitch', '양손조작안전스위치']],
  [['dashcam', '블랙박스'],       ['turnSignal', '방향지시등']],
  [['engineOil', '엔진오일'],     ['lubricant', '윤활제']],
  [['brake', '브레이크'],         ['tire', '타이어']],
  [['headlight', '전조등'],       ['carWash', '세차여부']],
];

type Detail = {
  passengers?: string;
  fuelCost?: number | null;
  operationRows?: Array<{ startTime?: string; endTime?: string; zone?: string; note?: string }>;
  bagWork?: Array<Record<string, unknown>>;
  bagMachineWork?: Record<string, number>;
  largeWasteWork?: Record<string, number>;
  inspection?: Record<string, string>;
  maintenance?: { company?: string; content?: string; cost?: number } | null;
  note?: string;
};

type Log = {
  id: string; logDate: string; vehicleNo: string; vehicleType: string; vehicleTon: string | null;
  contractorName: string | null; driverName: string; driverEmployeeNo: string | null;
  zoneName: string | null; startMileage: number | null; endMileage: number | null;
  fuelUsed: number | null; fuelTypeName: string | null; wasteWeightKg: number | null;
  tripCount: number | null; routeDetail: string | null; status: string;
};

function parseDetail(raw: string | null): Detail {
  if (!raw) return {};
  try { return JSON.parse(raw) as Detail; }
  catch { return {}; }
}

/* ── 인쇄 양식 컴포넌트 ── */
function PrintArticle({ log, isSuperAdmin }: { log: Log; isSuperAdmin: boolean }) {
  const dateLabel = formatDateKr(log.logDate);
  const d = parseDetail(log.routeDetail);

  /* 항상 4차 — 데이터 있으면 채움, 없으면 빈 칸 */
  const opRows = Array.from({ length: 4 }, (_, i) => {
    const r = d.operationRows?.[i];
    return { start: r?.startTime ?? '', end: r?.endTime ?? '', zone: r?.zone ?? '', note: r?.note ?? '' };
  });

  const bagRows = Array.from({ length: 4 }, (_, i) => {
    const r = d.bagWork?.[i] as Record<string, unknown> | undefined;
    const gn = Number(r?.general ?? 0);
    const fd = Number(r?.food ?? 0);
    const rc = Number(r?.recycle ?? 0);
    return {
      general: gn > 0 ? gn.toLocaleString() : '',
      food:    fd > 0 ? fd.toLocaleString() : '',
      recycle: rc > 0 ? rc.toLocaleString() : '',
      site: typeof r?.disposalSite === 'string' ? r.disposalSite : '',
      note: typeof r?.note === 'string' ? r.note : '',
    };
  });

  const bm   = d.bagMachineWork  ?? {};
  const lw   = d.largeWasteWork  ?? {};
  const insp = d.inspection      ?? {};

  const dist = log.startMileage != null && log.endMileage != null
    ? (log.endMileage - log.startMileage).toLocaleString() + ' km'
    : '';

  const bmVal = (key: string) => (bm[key] && Number(bm[key]) > 0 ? Number(bm[key]).toLocaleString() : '');
  const lwVal = (key: string) => (lw[key] && Number(lw[key]) > 0 ? Number(lw[key]).toLocaleString() : '');
  const iv    = (key: string) => insp[key] ?? '';
  const isAb  = (key: string) => { const v = insp[key]; return v && v !== '양호' && v !== '예'; };

  return (
    <article className="vl-sheet">

      {/* ① 헤더: 제목 + 날짜 */}
      <div className="vl-hd">
        <span className="vl-doc-title">
          차량 운행일지<span className="vl-doc-subtitle">(폐기물관리법 제14조 5에 의함)</span>
        </span>
        <span className="vl-date-str">{dateLabel}</span>
      </div>

      {/* ② 기본정보 — 12열 3행, th 위치 col 1·5·9 로 통일 */}
      <table className="vl-info">
        <colgroup>
          <col style={{width:'72px'}} />{/* col1: th */}
          <col /><col /><col />           {/* col2-4: data */}
          <col style={{width:'62px'}} />{/* col5: th */}
          <col /><col /><col />           {/* col6-8: data */}
          <col style={{width:'62px'}} />{/* col9: th */}
          <col /><col /><col />           {/* col10-12: data */}
        </colgroup>
        <tbody>
          <tr>
            <th>차량번호</th>
            <td colSpan={3}>{log.vehicleNo}</td>
            <th>차&nbsp;&nbsp;종</th>
            <td colSpan={3}>{log.vehicleType}{log.vehicleTon ? ` (${log.vehicleTon.replace(/톤$/, '')} ton)` : ''}</td>
            <th>운전자</th>
            <td colSpan={3}>{log.driverName}{log.driverEmployeeNo ? ` (${log.driverEmployeeNo})` : ''}</td>
          </tr>
          <tr>
            <th>시작 누적</th>
            <td colSpan={3}>{log.startMileage != null ? `${log.startMileage.toLocaleString()} km` : ''}</td>
            <th>종료 누적</th>
            <td colSpan={3}>{log.endMileage != null ? `${log.endMileage.toLocaleString()} km` : ''}</td>
            <th>주행거리</th>
            <td colSpan={3}>{dist}</td>
          </tr>
          <tr>
            <th>주&nbsp;유&nbsp;량</th>
            <td colSpan={3}>{log.fuelUsed != null ? `${log.fuelUsed.toFixed(2)} ℓ` : ''}</td>
            <th>유&nbsp;&nbsp;종</th>
            <td colSpan={3}>{log.fuelTypeName ?? ''}</td>
            <th>동&nbsp;승&nbsp;자</th>
            <td colSpan={3}>
              {d.passengers ?? ''}
              {d.fuelCost ? <span className="vl-fuel-inline"> (주유금액 {Number(d.fuelCost).toLocaleString()}원)</span> : null}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ③ 표 1: 차량운행내역 */}
      <div className="vl-sec">◎ 차량운행내역 <span className="vl-notice">※지정 소각장 및 기타처리장 반입 상황에 따라 근무시간 조정</span></div>
      <table className="vl-tbl">
        <thead>
          <tr>
            <th className="wd-rd">회차</th>
            <th className="wd-tm">시작시간</th>
            <th className="wd-tm">종료시간</th>
            <th>작&nbsp;&nbsp;업&nbsp;&nbsp;구&nbsp;&nbsp;간</th>
            <th className="wd-nt">비&nbsp;&nbsp;고</th>
          </tr>
        </thead>
        <tbody>
          {opRows.map((r, i) => (
            <tr key={i}>
              <td className="tc">{i + 1}회차</td>
              <td className="tc mono">{r.start}</td>
              <td className="tc mono">{r.end}</td>
              <td>{r.zone}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ④ 표 2: 작업내역 A */}
      <div className="vl-sec">◎ 작업내역 A — 종량제봉투·음식물·재활용 (kg)</div>
      <table className="vl-tbl vl-tbl-a">
        <colgroup>
          <col style={{width:'40px'}} />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>회차</th>
            <th>일반</th>
            <th>음식물</th>
            <th>재활용</th>
            <th>반&nbsp;입&nbsp;장&nbsp;소</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {bagRows.map((r, i) => (
            <tr key={i}>
              <td className="tc">{i + 1}회차</td>
              <td className="tc">{r.general}</td>
              <td className="tc">{r.food}</td>
              <td className="tc">{r.recycle}</td>
              <td>{r.site}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ⑤ 표 3: 작업내역 B */}
      <div className="vl-sec">◎ 작업내역 B — 종량제봉투 수거 (ℓ)</div>
      <table className="vl-tbl vl-uniform vl-tbl-bc">
        <colgroup>
          <col style={{width:'22%'}} /><col style={{width:'11%'}} />
          <col style={{width:'22%'}} /><col style={{width:'11%'}} />
          <col style={{width:'22%'}} /><col style={{width:'12%'}} />
        </colgroup>
        <tbody>
          {BM_ROWS.map((row, ri) => (
            <tr key={ri}>
              {row.map(([key, label]) => (
                <React.Fragment key={key || label}>
                  <th className="wd-b-lbl">{label}</th>
                  <td className="tc wd-b-val">{key.startsWith('__') ? '' : bmVal(key)}</td>
                </React.Fragment>
              ))}
              {row.length < 3 && Array.from({ length: 3 - row.length }, (_, ei) => (
                <React.Fragment key={`e${ei}`}><th className="wd-b-lbl"></th><td className="wd-b-val"></td></React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ⑥ 표 4: 작업내역 C */}
      <div className="vl-sec">◎ 작업내역 C — 대형폐기물 (점)</div>
      <table className="vl-tbl vl-uniform vl-tbl-bc">
        <colgroup>
          <col style={{width:'22%'}} /><col style={{width:'11%'}} />
          <col style={{width:'22%'}} /><col style={{width:'11%'}} />
          <col style={{width:'22%'}} /><col style={{width:'12%'}} />
        </colgroup>
        <tbody>
          {LW_ROWS.map((row, ri) => (
            <tr key={ri}>
              {row.map(([key, label]) => (
                <React.Fragment key={key}>
                  <th className="wd-b-lbl">{label}</th>
                  <td className="tc wd-b-val">{lwVal(key)}</td>
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ⑦ 표 5: 차량점검 */}
      <div className="vl-sec">◎ 차량점검</div>
      <table className="vl-tbl vl-uniform">
        <tbody>
          {INSP_ROWS.map((row, ri) => (
            <tr key={ri}>
              {row.map(([key, label]) => (
                <React.Fragment key={key}>
                  <th className="wd-insp">{label}</th>
                  <td className={`tc wd-insp-val${isAb(key) ? ' vl-ab' : ''}`}>{iv(key)}</td>
                </React.Fragment>
              ))}
              {row.length < 2 && Array.from({ length: 2 - row.length }, (_, ei) => (
                <React.Fragment key={`e${ei}`}><th className="wd-insp"></th><td className="wd-insp-val"></td></React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ⑧ 정비이력 */}
      <div className="vl-sec">◎ 정비이력</div>
      <table className="vl-tbl">
        <colgroup>
          <col style={{width:'72px'}} />
          <col />
          <col style={{width:'72px'}} />
          <col style={{width:'100px'}} />
        </colgroup>
        <tbody>
          <tr>
            <th>정비업체</th>
            <td>{d.maintenance?.company ?? ''}</td>
            <th>수리비용</th>
            <td className="tc">{d.maintenance?.cost ? `${Number(d.maintenance.cost).toLocaleString()} 원` : ''}</td>
          </tr>
          <tr>
            <th>정비내용</th>
            <td colSpan={3} style={{minHeight:'26px'}}>{d.maintenance?.content ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* ⑨ 특이사항 */}
      <div className="vl-sec">◎ 특이사항</div>
      <table className="vl-tbl">
        <tbody>
          <tr>
            <td style={{minHeight:'26px', padding:'4px 6px'}}>{d.note ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* ⑩ 하단: 위탁업체명 + 운전자 서명 */}
      <table className="vl-tbl vl-footer-tbl">
        <tbody>
          <tr>
            <th className="wd-cmp">회사명</th>
            <td>{log.contractorName ?? ''}</td>
            <th className="wd-sig">운전자</th>
            <td className="wd-sig-val vl-sig-name">{log.driverName}</td>
          </tr>
        </tbody>
      </table>

    </article>
  );
}

/* ── 메인 클라이언트 컴포넌트 ── */
export default function VehiclePrintClient({
  date, selectedVehicleId, vehicles, logs: initialLogs, isSuperAdmin = false, autoprint = false,
}: {
  date: string;
  selectedVehicleId: string | null;
  vehicles: Array<{ id: string; vehicleNo: string; type: string }>;
  logs: Log[];
  isSuperAdmin?: boolean;
  autoprint?: boolean;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);
  const [vehicleId, setVehicleId] = useState(selectedVehicleId ?? '');
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handleDelete(logId: string, vehicleNo: string) {
    if (!confirm(`${vehicleNo} 차량일지를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    setDeletingId(logId);
    try {
      const res = await fetch(`/api/vehicle-logs/${logId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.message ?? d.error ?? '삭제 실패');
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (autoprint && logs.length > 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoprint, logs.length]);

  function navigate() {
    const params = new URLSearchParams({ date: selectedDate });
    if (vehicleId) params.set('vehicleId', vehicleId);
    router.push(`/vehicles/print?${params}`);
  }

  function handlePrint() {
    const params = new URLSearchParams({ date: selectedDate, autoprint: '1' });
    if (vehicleId) params.set('vehicleId', vehicleId);
    router.push(`/vehicles/print?${params}`);
  }

  async function handlePdfDownload() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (vehicleId) params.set('vehicleId', vehicleId);
      const res = await fetch(`/api/vehicle-logs/pdf?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message ?? j.error ?? 'PDF 생성 실패');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = vehicleId ? `_${logs.find((l) => l.vehicleNo)?.vehicleNo ?? ''}` : '_전체';
      a.download = `차량운행일지${suffix}_${selectedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* 컨트롤 바 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-xs font-mono font-extrabold text-slate-600 mb-1">날짜</div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-xs font-mono font-extrabold text-slate-600 mb-1">대상</div>
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
        <button onClick={handlePrint}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          🖨 인쇄
        </button>
        <button onClick={handlePdfDownload} disabled={pdfLoading || logs.length === 0}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
          {pdfLoading ? 'PDF 생성 중…' : '📄 PDF 저장'}
        </button>
        <a href={`/api/vehicle-logs/export?from=${selectedDate}&to=${selectedDate}`}
          download={`차량운행일지_${selectedDate}.xlsx`}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700">
          📥 Excel
        </a>
        <a href="/vehicles" className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-line hover:bg-slate-50">← 차량관리</a>
        <a href="/print" className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 border border-line hover:bg-slate-200">🖨 출력센터</a>
        {logs.length >= 200 && (
          <div className="w-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-3 py-1.5 mt-2">
            ⚠ 최대 200건까지 표시됩니다. 날짜 또는 차량을 좁혀 조회하세요.
          </div>
        )}
      </div>

      {/* 인쇄 영역 */}
      <div className="bg-white print:bg-white vl-print-wrap">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-600 print:hidden">해당 날짜의 운행일지가 없습니다.</div>
        ) : (
          <div>
            {logs.map((l) => (
              <div key={l.id} className="relative">
                {/* 삭제 버튼 — 인쇄 시 숨김 */}
                <div className="print:hidden flex justify-end mb-1 px-1">
                  <button
                    onClick={() => handleDelete(l.id, l.vehicleNo)}
                    disabled={deletingId === l.id}
                    className="px-3 py-1 rounded text-xs font-extrabold bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 active:scale-95 disabled:opacity-50 transition"
                  >
                    {deletingId === l.id ? '삭제 중…' : `🗑 ${l.vehicleNo} 삭제`}
                  </button>
                </div>
                <PrintArticle log={l} isSuperAdmin={isSuperAdmin} />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        /* ══ 스크롤바 전체 숨김 (화면 + 인쇄) ════════════════ */
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }

        /* ══ 공통 (화면 + 인쇄) ══════════════════════════════ */
        .vl-sheet {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
          background: #fff;
          padding: 12px;
          margin-bottom: 20px;
          border: 1.5px solid #555;
        }

        /* 헤더 */
        .vl-hd {
          display: flex;
          align-items: baseline;
          gap: 12px;
          border-bottom: 2.5px double #333;
          padding-bottom: 5px;
          margin-bottom: 6px;
        }
        .vl-doc-title    { font-size: 18pt; font-weight: 900; letter-spacing: -0.5px; }
        .vl-doc-subtitle { font-size: 8pt; font-weight: 600; color: #333; margin-left: 5px; vertical-align: middle; }
        .vl-plate-no     { font-size: 12pt; font-weight: 700; color: #222; }
        .vl-date-str     { font-size: 10pt; font-weight: 600; color: #444; margin-left: auto; }
        .vl-fuel-inline  { font-size: 8.5pt; color: #444; }

        /* 작업내역 A — 회차 30px 고정, 나머지 5열 균등 */
        .vl-tbl-a { table-layout: fixed; }

        /* 작업내역 B·C — 동일 6열 고정 레이아웃 */
        .vl-tbl-bc { table-layout: fixed; }

        /* 공통 테이블 */
        .vl-info, .vl-tbl {
          width: 100%;
          border-collapse: collapse;
        }
        .vl-info { margin-bottom: 4px; }
        .vl-tbl  { margin-bottom: 12px; }
        .vl-info th, .vl-info td,
        .vl-tbl  th, .vl-tbl  td {
          border: 1px solid #666;
          padding: 4px 5px;
          font-size: 10pt;
          vertical-align: middle;
        }
        .vl-info th, .vl-tbl  th {
          background: #f0f0f0;
          font-weight: 700;
          white-space: nowrap;
        }
        .tc   { text-align: center; }
        .mono { font-family: 'Courier New', monospace; }

        /* 기본정보 — 8열 균등분배(12.5%), 긴 값은 ellipsis */
        .vl-info { table-layout: fixed; }
        .vl-info th { white-space: nowrap; overflow: hidden; }
        .vl-info td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* 작업B·C·차량점검 세로 간격 통일 */
        .vl-uniform tr { height: 24px; }
        .vl-uniform th,
        .vl-uniform td  { padding: 3px 5px !important; line-height: 1.3; }

        /* 섹션 제목 */
        .vl-sec {
          font-size: 10pt;
          font-weight: 700;
          border-left: 3px solid #333;
          padding: 2px 0 2px 6px;
          margin: 12px 0 2px;
          background: #f8f8f8;
        }
        .vl-notice {
          font-size: 8pt;
          font-weight: normal;
          color: #666;
          margin-left: 6px;
        }

        /* 표 1/2 열 너비 */
        .wd-rd { width: 40px; }
        .wd-tm { width: 58px; }
        .wd-nt { width: 80px; }
        .wd-nm { width: 48px; }

        /* 표 3 열 너비 */
        .wd-b-lbl { width: 74px; background: #f0f0f0; font-size: 9.5pt; }
        .wd-b-val { width: 34px; }

        /* 표 5 열 너비 — 2열 구성 */
        .wd-insp     { width: 120px; background: #f0f0f0; font-size: 9.5pt; }
        .wd-insp-val { width: 60px; }

        /* 이상 값 강조 */
        .vl-ab { color: #c00000; font-weight: 700; }

        /* 하단 */
        .vl-footer-tbl { margin-top: 4px; page-break-inside: avoid; break-inside: avoid; page-break-before: avoid; break-before: avoid; }
        .wd-cmp      { width: 75px; }
        .wd-sig      { width: 50px; }
        .wd-sig-val  { width: 90px; min-height: 28px; }
        .vl-sig-name {
          font-size: 10pt;
          font-weight: 700;
          color: #111;
          padding-bottom: 2px;
          border-bottom: 1px solid #555;
        }

        /* ══ 인쇄 전용 (A4 portrait, 좌우 8mm / 상하 10mm) ════════════════ */
        @media print {
          header, aside, nav, [data-sidebar], .sidebar { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          /* 관리자 레이아웃 section(overflow-y-auto)·main 해제 → 모든 페이지 인쇄 + 스크롤바 제거 */
          main, section { overflow: visible !important; height: auto !important; }
          ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          html { scrollbar-width: none !important; }
          .print\\:hidden { display: none !important; }

          @page { size: A4 portrait; margin: 10mm 8mm; }

          body { font-size: 9pt !important; background: white !important; }

          /* 배경색 전체 제거 */
          .vl-sheet, .vl-hd,
          .vl-info th, .vl-info td,
          .vl-tbl  th, .vl-tbl  td,
          .vl-sec, .wd-b-lbl, .wd-insp {
            background: white !important;
            background-color: white !important;
          }

          /* space-y 마진 제거 — 첫 페이지와 후속 페이지 title 간격 통일 */
          .vl-print-wrap { margin-top: 0 !important; }

          /* 차량 1대 = 1페이지
           래퍼 div를 투명화하여 :last-child 선택자가 전체 목록 기준으로 동작 */
          .vl-print-wrap .relative { display: contents; }

          .vl-sheet {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 12px 0 0 0 !important;
            border: none !important;
          }
          .vl-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* 빈 행 숨김 */
          .vl-empty-row { display: none !important; }

          /* 폰트 크기 */
          .vl-doc-title    { font-size: 14pt !important; }
          .vl-doc-subtitle { font-size: 8pt !important; }
          .vl-date-str     { font-size: 9pt !important; }

          .vl-info { table-layout: fixed !important; }
          .vl-info th { white-space: nowrap !important; overflow: hidden !important; }
          .vl-info td { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .vl-info th, .vl-info td,
          .vl-tbl  th, .vl-tbl  td {
            font-size: 9pt !important;
            padding: 3px 4px !important;
          }
          /* 작업B·C·차량점검 세로 간격 통일 */
          .vl-uniform tr { height: 22px !important; }
          .vl-uniform th,
          .vl-uniform td  { padding: 2px 4px !important; font-size: 8.5pt !important; }
          .wd-b-lbl, .wd-insp { font-size: 8.5pt !important; }
          .vl-tbl    { margin-bottom: 7px !important; }
          .vl-sec    { font-size: 9pt !important; margin: 7px 0 2px !important; padding: 1px 0 1px 5px !important; }
          .vl-notice { font-size: 7.5pt !important; }
        }
      `}</style>
    </div>
  );
}
