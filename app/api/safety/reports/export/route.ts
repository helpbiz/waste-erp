/**
 * GET /api/safety/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 산업안전보건 보고서 Excel 다운로드 — MUNI_ADMIN 포함 관리자 전용
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { safetyWhere, isSafetyManager, severityLabel, safetyTypeLabel, safetyStatusLabel } from '@/lib/safety';
import ExcelJS from 'exceljs';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isSafetyManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');

  const base = safetyWhere(session);
  const where = {
    ...base,
    ...(from || to ? {
      reportDate: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
      },
    } : {}),
  };

  const reports = await prisma.safetyReport.findMany({
    where,
    orderBy: [{ reportDate: 'desc' }, { id: 'desc' }],
    take: 2000,
    include: {
      reporter:  { select: { name: true } },
      reviewer:  { select: { name: true } },
      contractor: { select: { companyName: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Clean ERP';
  const ws = wb.addWorksheet('안전보건 보고서');

  const period = from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '전체';
  const HEADERS = ['No', '보고일', '업체명', '보고 유형', '심각도', '상태', '보고자', '발생 내용', '검토 메모', '검토자'];
  const COL_WIDTHS = [6, 12, 20, 14, 10, 12, 12, 40, 30, 12];
  applyStandardHeader(ws, { title: '산업안전보건 보고서', colCount: HEADERS.length, period, totalCount: reports.length });
  addHeaderRow(ws, HEADERS);

  reports.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      r.reportDate.toISOString().slice(0, 10),
      r.contractor?.companyName ?? '',
      safetyTypeLabel(r.reportType),
      severityLabel(r.severity ?? 'NONE'),
      safetyStatusLabel(r.status),
      r.reporter?.name ?? '',
      r.description ?? '',
      r.reviewNote ?? '',
      r.reviewer?.name ?? '',
    ]);
    styleDataRow(row, i);
  });

  ws.columns.forEach((col, idx) => { col.width = COL_WIDTHS[idx] ?? 12; });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('안전보건보고서'));
}
