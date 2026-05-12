/**
 * POST /api/import/parse
 * Excel 파일을 파싱해 시트별 헤더+샘플+전체 행 데이터를 반환한다.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager } from '@/lib/vehicle-logs';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart_required' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arrayBuffer);
  } catch {
    return NextResponse.json({ error: 'invalid_excel', message: 'Excel 파일을 읽을 수 없습니다.' }, { status: 400 });
  }

  const sheets: Array<{
    name: string;
    headers: string[];
    sample: Record<string, string>[];
    rows: Record<string, string>[];
  }> = [];

  for (const ws of wb.worksheets) {
    if (ws.rowCount < 2) continue;

    /* 헤더 행 자동 감지: 텍스트 셀 2개 이상인 첫 행 */
    let headerRowIdx = 1;
    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const vals = (ws.getRow(r).values as unknown[]).slice(1);
      const texts = vals.filter((v) => typeof v === 'string' && (v as string).trim().length > 0);
      if (texts.length >= 2) { headerRowIdx = r; break; }
    }

    /* 헤더 추출 */
    const headerRow = ws.getRow(headerRowIdx);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col - 1] = cellToString(cell);
    });
    const cleanHeaders = headers.filter(Boolean);
    if (cleanHeaders.length < 2) continue;

    /* 데이터 행 추출 */
    const rows: Record<string, string>[] = [];
    for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, string> = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const h = headers[col - 1];
        if (h) {
          const v = cellToString(cell);
          obj[h] = v;
          if (v.trim()) hasValue = true;
        }
      });
      if (hasValue) rows.push(obj);
    }
    if (rows.length === 0) continue;

    sheets.push({ name: ws.name, headers: cleanHeaders, sample: rows.slice(0, 3), rows });
  }

  if (sheets.length === 0) {
    return NextResponse.json({ error: 'no_valid_sheets', message: '유효한 데이터 시트를 찾을 수 없습니다.' }, { status: 400 });
  }

  return NextResponse.json({ sheets });
}

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('result' in v) return String((v as ExcelJS.CellFormulaValue).result ?? '');
    if ('error' in v) return '';
    if ('text' in v) return String((v as { text: string }).text);
  }
  return String(v);
}
