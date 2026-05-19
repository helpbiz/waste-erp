/**
 * 표준 엑셀 출력물 유틸리티
 *
 * 레이아웃:
 *   1행: 메뉴 제목  (16pt, 전체 컬럼 병합, 가운데)
 *   2행: 조회기간 | 총 N건  (9pt, 전체 컬럼 병합, 가운데)
 *   3행: 빈 행 (spacer)
 *   4행: 컬럼 헤더  (맑은 고딕 bold, 배경색)
 *   5행~: 데이터 (표 테두리)
 *
 * 파일명: 한글메뉴제목_YYYYMMDD_HHMMSS.xlsx
 */
import ExcelJS from 'exceljs';

const HEADER_BG = 'FF1E5C7C';
const HEADER_FG = 'FFFFFFFF';
const BORDER_CLR = 'FFD1D5DB';
const STRIPE_CLR = 'FFF8FAFC';

function colAddress(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * 워크시트 1~3행에 표준 헤더 삽입.
 * 반드시 데이터 행 추가 전에 호출할 것.
 */
export function applyStandardHeader(
  ws: ExcelJS.Worksheet,
  opts: {
    title: string;
    colCount: number;
    period: string;
    totalCount: number;
    unit?: string;
  },
) {
  const { title, colCount, period, totalCount, unit = '건' } = opts;
  const last = colAddress(colCount);

  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { name: '맑은 고딕', bold: true, size: 16 };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 40;

  ws.mergeCells(`A2:${last}2`);
  const p = ws.getCell('A2');
  p.value = `조회기간: ${period}  |  총 ${totalCount.toLocaleString()}${unit}`;
  p.font = { name: '맑은 고딕', size: 9 };
  p.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.addRow([]); // row 3 spacer
  ws.getRow(3).height = 6;
}

/** 4행 컬럼 헤더 행 추가 */
export function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[]): ExcelJS.Row {
  const row = ws.addRow(headers);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: '맑은 고딕', bold: true, size: 10, color: { argb: HEADER_FG } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'medium' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  row.height = 28;
  return row;
}

/**
 * 데이터 행에 표 테두리 + 맑은 고딕 적용.
 * rowIndex: 데이터 내 1-based 인덱스 (짝수 행에 줄무늬 배경)
 */
export function styleDataRow(row: ExcelJS.Row, rowIndex: number) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (!cell.font?.name) cell.font = { name: '맑은 고딕', size: 9 };
    cell.border = {
      top:    { style: 'thin', color: { argb: BORDER_CLR } },
      bottom: { style: 'thin', color: { argb: BORDER_CLR } },
      left:   { style: 'thin', color: { argb: BORDER_CLR } },
      right:  { style: 'thin', color: { argb: BORDER_CLR } },
    };
    if (rowIndex % 2 === 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_CLR } };
    }
  });
}

/** 표준 파일명: 한글제목_YYYYMMDD_HHMMSS.xlsx */
export function makeFilename(korTitle: string): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${korTitle}_${date}_${time}.xlsx`;
}

/** xlsx Response 헬퍼 */
export function xlsxResponse(buf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buf.length),
    },
  });
}
