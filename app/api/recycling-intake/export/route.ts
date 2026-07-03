/**
 * GET /api/recycling-intake/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 자원순환센터 반입실적 기간별 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: '일반', FOOD: '음식물', RECYCLING: '재활용', WOOD: '폐목재',
};

function contractorScope(session: { role: string; contractorId: string | null; municipalityId: string | null }): Prisma.RecyclingCenterIntakeWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');

  const where: Prisma.RecyclingCenterIntakeWhereInput = { ...contractorScope(session) };
  if (from || to) {
    where.intakeDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to) }   : {}),
    };
  }

  const records = await prisma.recyclingCenterIntake.findMany({
    where,
    orderBy: [{ intakeDate: 'asc' }, { intakeTime: 'asc' }, { id: 'asc' }],
    take: 5000,
    include: {
      vehicle:     { select: { vehicleNo: true } },
      facility:    { select: { name: true } },
      disposalSite: { select: { name: true } },
      recorder:    { select: { name: true } },
      contractor:  { select: { companyName: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Clean ERP';
  const ws = wb.addWorksheet('반입실적');

  const period = from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '전체';
  const totalKg = records.reduce((s, r) => s + Number(r.weightTon) * 1000, 0);

  const HEADERS = ['No', '일자', '반입시간', '업체명', '차량번호', '성상', '반입량(kg)', '처리시설', '반입장소', '비고', '기록자'];
  const COL_WIDTHS = [6, 12, 10, 20, 14, 10, 12, 22, 22, 25, 12];

  applyStandardHeader(ws, { title: '자원순환센터 반입실적', colCount: HEADERS.length, period, totalCount: records.length });

  // 합계 요약 행
  const summaryRow = ws.addRow([`총 반입량: ${Math.round(totalKg).toLocaleString()} kg`, '', '', '', '', '', '', '', '', '', '']);
  ws.mergeCells(`A4:K4`);
  summaryRow.getCell(1).font = { name: '맑은 고딕', bold: true, size: 10 };
  summaryRow.getCell(1).alignment = { horizontal: 'right' };
  ws.getRow(4).height = 18;

  addHeaderRow(ws, HEADERS);

  records.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      r.intakeDate.toISOString().slice(0, 10),
      r.intakeTime,
      r.contractor?.companyName ?? '',
      r.vehicle?.vehicleNo ?? '',
      CATEGORY_LABEL[r.materialCategory] ?? r.materialCategory,
      Math.round(Number(r.weightTon) * 1000),
      r.facility?.name ?? '',
      r.disposalSite?.name ?? '',
      r.note ?? '',
      r.recorder?.name ?? '',
    ]);
    const weightCell = row.getCell(7);
    weightCell.numFmt = '#,##0';
    weightCell.alignment = { horizontal: 'right' };
    styleDataRow(row, i);
  });

  ws.columns.forEach((col, idx) => { col.width = COL_WIDTHS[idx] ?? 12; });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('반입실적'));
}
