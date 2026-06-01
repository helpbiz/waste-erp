/**
 * GET /api/safety/weather-notices/[id]/export?images=true
 * 날씨관리대장 Excel 출력 — 기록 내용 + 선택적 이미지 임베드
 */
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { parseId } from '@/lib/ids';
import { makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

const ALERT_LABEL: Record<string, string> = {
  HEATWAVE: '폭염', COLDWAVE: '한파', TYPHOON: '태풍', STORM: '강풍·폭우', OTHER: '기타',
};

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const noticeId = parseId(params.id);
  if (noticeId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const url = new URL(req.url);
  const withImages = url.searchParams.get('images') !== 'false';

  const notice = await prisma.weatherSafetyNotice.findUnique({
    where: { id: noticeId },
    select: { id: true, title: true, noticeDate: true, contractorId: true, alertType: true, content: true },
  });
  if (!notice) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (session.contractorId && notice.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const records = await prisma.weatherSafetyPhoto.findMany({
    where: { noticeId },
    orderBy: { uploadedAt: 'asc' },
    include: { worker: { select: { name: true, employeeNo: true } } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  const ws = wb.addWorksheet('날씨관리대장');

  const alertLabel = ALERT_LABEL[notice.alertType] ?? notice.alertType;
  const dateStr = notice.noticeDate.toISOString().slice(0, 10);
  const COLS = withImages ? 8 : 7;

  /* ── 타이틀 ── */
  ws.mergeCells(1, 1, 1, COLS);
  const t1 = ws.getCell(1, 1);
  t1.value = `날씨관리대장 (${alertLabel})`;
  t1.font = { bold: true, size: 14 };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  ws.mergeCells(2, 1, 2, COLS);
  const t2 = ws.getCell(2, 1);
  t2.value = `공지: ${notice.title} | 날짜: ${dateStr} | 제출 ${records.length}명`;
  t2.font = { size: 9, color: { argb: 'FF555555' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18;

  ws.addRow([]); // spacer
  ws.getRow(3).height = 6;

  /* ── 헤더 ── */
  const headers = ['순번', '직원명', '사원번호', '기록시간', '체감온도(℃)', '조치사항', '담당자'];
  if (withImages) headers.push('휴식 인증 사진');
  const hRow = ws.addRow(headers); // row 4
  hRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  hRow.height = 22;
  hRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5C7C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });

  /* ── 데이터 ── */
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const rowNo = i + 5; // 1~3: 타이틀, 4: 헤더, 5~: 데이터

    const rowData = [
      i + 1,
      r.worker.name,
      r.worker.employeeNo ?? '—',
      r.recordTime ?? '—',
      r.feelsLike != null ? r.feelsLike : '—',
      r.actionTaken ?? '—',
      r.managerName ?? '—',
    ];
    const dataRow = ws.addRow(rowData);
    dataRow.height = withImages ? 70 : 18;
    dataRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      if (col === 6) {
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    /* 이미지 임베드 */
    if (withImages && r.photoData) {
      try {
        const base64 = r.photoData.includes(',') ? r.photoData.split(',')[1] : r.photoData;
        const ext = r.photoData.startsWith('data:image/png') ? 'png' : 'jpeg';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imgId = (wb as any).addImage({ base64, extension: ext });
        ws.addImage(imgId, {
          tl: { col: COLS - 1, row: rowNo - 1 },
          ext: { width: 80, height: 60 },
        });
      } catch { /* 이미지 오류 시 무시 */ }
    }
  }

  /* ── 열 너비 ── */
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 35;
  ws.getColumn(7).width = 12;
  if (withImages) ws.getColumn(8).width = 14;

  /* ── 인쇄 설정 ── */
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = makeFilename(`날씨관리대장_${alertLabel}`);
  return xlsxResponse(buf, filename);
}
