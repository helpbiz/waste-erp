/**
 * GET /api/print/tbm-excel?yearMonth=YYYY-MM
 * TBM 안전교육 월별 기록 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 텍스트 내용과 열 너비 기준으로 행 높이(pt) 자동 계산.
 * 한글/CJK는 2칸, ASCII는 1칸으로 환산 후 열 너비 대비 줄바꿈 횟수 산출.
 */
function calcRowHeight(
  entries: Array<{ text: string; colWidth: number }>,
  fontSizePt = 9
): number {
  const lineHeightPt = fontSizePt * 1.5;
  let maxLines = 1;

  const charWidth = (s: string) =>
    [...s].reduce((n, c) => n + (c.codePointAt(0)! > 0x7f ? 2 : 1), 0);

  for (const { text, colWidth } of entries) {
    if (!text) continue;
    const charsPerLine = Math.max(5, Math.floor(colWidth));
    let lines = 0;
    for (const para of text.split('\n')) {
      if (para === '') { lines++; continue; }
      lines += Math.max(1, Math.ceil(charWidth(para) / charsPerLine));
    }
    maxLines = Math.max(maxLines, lines);
  }

  return Math.max(18, Math.min(240, Math.ceil(maxLines * lineHeightPt) + 4));
}

function parseTbmContent(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && 'text' in p) return p.text ?? null;
  } catch {}
  return raw;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId)
    return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const yearMonth = url.searchParams.get('yearMonth') ?? new Date().toISOString().slice(0, 7);
  const [y, m] = yearMonth.split('-').map(Number);

  const from = new Date(Date.UTC(y, m - 1, 1));
  const to   = new Date(Date.UTC(y, m, 1));

  const sessions = await prisma.tbmSession.findMany({
    where: {
      contractorId: BigInt(session.contractorId),
      sessionDate: { gte: from, lt: to },
    },
    include: {
      creator: { select: { name: true } },
      signatures: {
        include: { worker: { select: { name: true, employeeNo: true } } },
        orderBy: { signedAt: 'asc' },
      },
    },
    orderBy: { sessionDate: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Clean ERP';
  const ws = wb.addWorksheet(`${y}년${m}월`);

  const COLS = 7;

  /* ── 1행: 타이틀 ── */
  ws.mergeCells(1, 1, 1, COLS);
  const tc = ws.getCell(1, 1);
  tc.value = `TBM 안전교육 — ${y}년 ${m}월`;
  tc.font = { bold: true, size: 14, underline: true };
  tc.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  /* ── 2행: 헤더 ── */
  const hRow = ws.addRow(['날짜', '팀/부서', '주제', '교육 내용', '등록자', '서명 인원', '서명자 목록']);
  hRow.font = { bold: true, size: 10 };
  hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  hRow.height = 22;
  hRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = {
      top: { style: 'thin' }, bottom: { style: 'medium' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });

  /* ── 데이터 행 ── */
  sessions.forEach((s, idx) => {
    const d = new Date(s.sessionDate);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dow = DOW[d.getUTCDay()];
    const dateStr = `${mm}월 ${dd}일 (${dow})`;
    const signerList = s.signatures.map((sig) => sig.worker.name).join(', ');

    const contentText = parseTbmContent(s.content ?? null) ?? '';
    const row = ws.addRow([
      dateStr,
      s.department ?? '',
      s.topic,
      contentText,
      s.creator.name,
      s.signatures.length,
      signerList,
    ]);
    row.font = { size: 9 };
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = calcRowHeight([
      { text: s.topic,          colWidth: 28 },
      { text: contentText,      colWidth: 40 },
      { text: signerList,       colWidth: 40 },
    ]);
    if (idx % 2 === 1)
      row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    row.eachCell((c) => {
      c.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  });

  /* ── 열 너비 ── */
  const widths = [14, 12, 28, 40, 10, 8, 40];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  /* ── 인쇄 설정 ── */
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = {
    oddHeader: `&C&B&UTBM 안전교육 — ${y}년 ${m}월`,
    oddFooter: '&R&P / &N',
  };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`TBM안전교육_${yearMonth}`)}.xlsx`,
    },
  });
}
