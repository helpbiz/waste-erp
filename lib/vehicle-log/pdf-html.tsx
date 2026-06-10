// server-only: Puppeteer PDF용 차량일지 HTML 생성
// 반드시 1대 = 1페이지 (height:277mm + overflow:hidden 고정)
import 'server-only';
import React from 'react';

export type VehicleLogPdfData = {
  id: string;
  logDate: string;
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
  fuelTypeName: string | null;
  wasteWeightKg: number | null;
  tripCount: number | null;
  routeDetail: string | null;
  status: string;
};

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

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKr(s: string) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${DOW[d.getDay()]})`;
}

function parseDetail(raw: string | null): Detail {
  if (!raw) return {};
  try { return JSON.parse(raw) as Detail; } catch { return {}; }
}

const BM_ROWS: Array<Array<[string, string]>> = [
  [['food_1L', '음식물 1ℓ'],    ['food_2L', '음식물 2ℓ'],   ['food_3L', '음식물 3ℓ']],
  [['food_5L', '음식물 5ℓ'],    ['food_10L', '음식물 10ℓ'],  ['living_10L', '일 반 10ℓ']],
  [['living_20L', '일 반 20ℓ'], ['living_30L', '일 반 30ℓ'], ['living_50L', '일 반 50ℓ']],
  [['living_75L', '일 반 75ℓ'], ['reuse_10L', '재사용 10ℓ'], ['reuse_20L', '재사용 20ℓ']],
  [['illegal_20', '무단투기 20ℓ기준'], ['__blank__', ''],    ['special', '특수']],
];

const LW_ROWS: Array<Array<[string, string]>> = [
  [['furniture', '가구류'],  ['bed', '침대류'],        ['household', '생활용품']],
  [['chair', '의자류'],      ['appliance', '가전제품'], ['other', '기타']],
  [['sofa', '쇼파류'],       ['extinguisher', '소화기'],['illegalTotal', '무단투기 총합']],
];

const INSP_ROWS: Array<Array<[string, string]>> = [
  [['safetyBar', '안전멈춤Bar'],  ['handSwitch', '양손조작안전스위치']],
  [['dashcam', '블랙박스'],       ['turnSignal', '방향지시등']],
  [['engineOil', '엔진오일'],     ['lubricant', '윤활제']],
  [['brake', '브레이크'],         ['tire', '타이어']],
  [['headlight', '전조등'],       ['carWash', '세차여부']],
];

/* ── 1대 1페이지 고정 CSS ── */
const VL_CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }

/* 1페이지 = 1대 고정 컨테이너 — div가 A4 전체(210×297mm)를 차지해야 Chromium이 정확히 1페이지=1대로 인식 */
.vl-page {
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  background: #fff;
  padding: 10mm 10mm 8mm 10mm;
}
.vl-page:last-child {
  page-break-after: avoid;
  break-after: avoid;
}

/* 헤더 */
.vl-hd {
  display: flex; align-items: baseline; gap: 10px;
  border-bottom: 2.5px double #333;
  padding-bottom: 4px; margin-bottom: 5px;
}
.vl-doc-title    { font-size: 14pt; font-weight: 900; letter-spacing: -0.5px; }
.vl-doc-subtitle { font-size: 7.5pt; font-weight: 600; color: #333; margin-left: 4px; }
.vl-date-str     { font-size: 9pt; font-weight: 600; color: #444; margin-left: auto; }
.vl-fuel-inline  { font-size: 8pt; color: #555; }

/* 공통 테이블 */
.vl-info, .vl-tbl {
  width: 100%; border-collapse: collapse;
}
.vl-info { margin-bottom: 3px; table-layout: fixed; }
.vl-tbl  { margin-bottom: 6px; }
.vl-info th, .vl-info td,
.vl-tbl  th, .vl-tbl  td {
  border: 1px solid #666;
  padding: 3px 4px;
  font-size: 9pt;
  vertical-align: middle;
}
.vl-info th, .vl-tbl th {
  background: #f0f0f0;
  font-weight: 700;
  white-space: nowrap;
}
.vl-info th { overflow: hidden; }
.vl-info td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 섹션 제목 */
.vl-sec {
  font-size: 9pt; font-weight: 700;
  border-left: 3px solid #333;
  padding: 1px 0 1px 5px;
  margin: 6px 0 2px;
  background: #f8f8f8;
}
.vl-notice { font-size: 7.5pt; font-weight: normal; color: #666; margin-left: 5px; }

/* 열 너비 */
.wd-rd   { width: 40px; }
.wd-tm   { width: 56px; }
.wd-nt   { width: 76px; }
.tc      { text-align: center; }
.mono    { font-family: 'Courier New', monospace; }

/* 작업내역 A */
.vl-tbl-a { table-layout: fixed; }

/* 작업 B·C 동일 6열 */
.vl-tbl-bc  { table-layout: fixed; }
.wd-b-lbl   { width: 70px; background: #f0f0f0; font-size: 8.5pt; }
.wd-b-val   { width: 33px; }

/* B·C·차량점검 행 높이 통일 */
.vl-uniform tr           { height: 20px; }
.vl-uniform th,
.vl-uniform td           { padding: 2px 4px !important; font-size: 8.5pt; line-height: 1.2; }

/* 차량점검 */
.wd-insp     { width: 116px; background: #f0f0f0; font-size: 8.5pt; }
.wd-insp-val { width: 58px; }
.vl-ab       { color: #c00000; font-weight: 700; }

/* 특이사항·정비내용 — 최대 2줄 고정 */
.vl-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  max-height: 2.8em;
}

/* 하단 */
.vl-footer-tbl { margin-top: 3px; }
.wd-cmp     { width: 72px; }
.wd-sig     { width: 48px; }
.wd-sig-val { width: 88px; }
.vl-sig-name {
  font-size: 9.5pt; font-weight: 700; color: #111;
  padding-bottom: 2px; border-bottom: 1px solid #555;
}
`;

function LogPage({ log }: { log: VehicleLogPdfData }) {
  const d = parseDetail(log.routeDetail);
  const dateLabel = formatDateKr(log.logDate);

  const opRows = Array.from({ length: 4 }, (_, i) => {
    const r = d.operationRows?.[i];
    return { start: r?.startTime ?? '', end: r?.endTime ?? '', zone: r?.zone ?? '', note: r?.note ?? '' };
  });

  const bagRows = Array.from({ length: 4 }, (_, i) => {
    const r = d.bagWork?.[i] as Record<string, unknown> | undefined;
    return {
      general: Number(r?.general ?? 0) > 0 ? Number(r?.general).toLocaleString() : '',
      food:    Number(r?.food    ?? 0) > 0 ? Number(r?.food).toLocaleString()    : '',
      recycle: Number(r?.recycle ?? 0) > 0 ? Number(r?.recycle).toLocaleString() : '',
      site: typeof r?.disposalSite === 'string' ? r.disposalSite : '',
      note: typeof r?.note       === 'string' ? r.note        : '',
    };
  });

  const bm   = d.bagMachineWork ?? {};
  const lw   = d.largeWasteWork ?? {};
  const insp = d.inspection ?? {};
  const dist = log.startMileage != null && log.endMileage != null
    ? `${(log.endMileage - log.startMileage).toLocaleString()} km` : '';

  const bmVal = (k: string) => (bm[k] && Number(bm[k]) > 0 ? Number(bm[k]).toLocaleString() : '');
  const lwVal = (k: string) => (lw[k] && Number(lw[k]) > 0 ? Number(lw[k]).toLocaleString() : '');
  const iv    = (k: string) => insp[k] ?? '';
  const isAb  = (k: string) => { const v = insp[k]; return v && v !== '양호' && v !== '예'; };

  return (
    <div className="vl-page">
      {/* 헤더 */}
      <div className="vl-hd">
        <span className="vl-doc-title">
          차량 운행일지<span className="vl-doc-subtitle">(폐기물관리법 제14조 5에 의함)</span>
        </span>
        <span className="vl-date-str">{dateLabel}</span>
      </div>

      {/* 기본정보 */}
      <table className="vl-info">
        <colgroup>
          <col style={{ width: '70px' }} /><col /><col /><col />
          <col style={{ width: '60px' }} /><col /><col /><col />
          <col style={{ width: '60px' }} /><col /><col /><col />
        </colgroup>
        <tbody>
          <tr>
            <th>차량번호</th><td colSpan={3}>{log.vehicleNo}</td>
            <th>차&nbsp;&nbsp;종</th><td colSpan={3}>{log.vehicleType}{log.vehicleTon ? ` (${log.vehicleTon.replace(/톤$/, '')} ton)` : ''}</td>
            <th>운전자</th><td colSpan={3}>{log.driverName}{log.driverEmployeeNo ? ` (${log.driverEmployeeNo})` : ''}</td>
          </tr>
          <tr>
            <th>시작 누적</th><td colSpan={3}>{log.startMileage != null ? `${log.startMileage.toLocaleString()} km` : ''}</td>
            <th>종료 누적</th><td colSpan={3}>{log.endMileage != null ? `${log.endMileage.toLocaleString()} km` : ''}</td>
            <th>주행거리</th><td colSpan={3}>{dist}</td>
          </tr>
          <tr>
            <th>주&nbsp;유&nbsp;량</th><td colSpan={3}>{log.fuelUsed != null ? `${log.fuelUsed.toFixed(2)} ℓ` : ''}</td>
            <th>유&nbsp;&nbsp;종</th><td colSpan={3}>{log.fuelTypeName ?? ''}</td>
            <th>동&nbsp;승&nbsp;자</th>
            <td colSpan={3}>
              {d.passengers ?? ''}
              {d.fuelCost ? <span className="vl-fuel-inline"> ({Number(d.fuelCost).toLocaleString()}원)</span> : null}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 차량운행내역 */}
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

      {/* 작업내역 A */}
      <div className="vl-sec">◎ 작업내역 A — 종량제봉투·음식물·재활용 (kg)</div>
      <table className="vl-tbl vl-tbl-a">
        <colgroup>
          <col style={{ width: '38px' }} /><col /><col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr>
            <th>회차</th><th>일반</th><th>음식물</th><th>재활용</th>
            <th>반&nbsp;입&nbsp;장&nbsp;소</th><th>비고</th>
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

      {/* 작업내역 B */}
      <div className="vl-sec">◎ 작업내역 B — 종량제봉투 수거 (ℓ)</div>
      <table className="vl-tbl vl-uniform vl-tbl-bc">
        <colgroup>
          <col style={{ width: '22%' }} /><col style={{ width: '11%' }} />
          <col style={{ width: '22%' }} /><col style={{ width: '11%' }} />
          <col style={{ width: '22%' }} /><col style={{ width: '12%' }} />
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
                <React.Fragment key={`e${ei}`}><th className="wd-b-lbl" /><td className="wd-b-val" /></React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 작업내역 C */}
      <div className="vl-sec">◎ 작업내역 C — 대형폐기물 (점)</div>
      <table className="vl-tbl vl-uniform vl-tbl-bc">
        <colgroup>
          <col style={{ width: '22%' }} /><col style={{ width: '11%' }} />
          <col style={{ width: '22%' }} /><col style={{ width: '11%' }} />
          <col style={{ width: '22%' }} /><col style={{ width: '12%' }} />
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

      {/* 차량점검 */}
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
                <React.Fragment key={`e${ei}`}><th className="wd-insp" /><td className="wd-insp-val" /></React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 정비이력 */}
      <div className="vl-sec">◎ 정비이력</div>
      <table className="vl-tbl">
        <colgroup>
          <col style={{ width: '70px' }} /><col /><col style={{ width: '70px' }} /><col style={{ width: '96px' }} />
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
            <td colSpan={3}><div className="vl-clamp-2">{d.maintenance?.content ?? ''}</div></td>
          </tr>
        </tbody>
      </table>

      {/* 특이사항 */}
      <div className="vl-sec">◎ 특이사항</div>
      <table className="vl-tbl">
        <tbody>
          <tr>
            <td style={{ padding: '3px 5px', height: '24px' }}>
              <div className="vl-clamp-2">{d.note ?? ''}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 하단 */}
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
    </div>
  );
}

export async function renderVehicleLogHtml(logs: VehicleLogPdfData[]): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const body = renderToStaticMarkup(
    <>{logs.map((log) => <LogPage key={log.id} log={log} />)}</>
  );
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>차량 운행일지</title>
  <style>${VL_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}
