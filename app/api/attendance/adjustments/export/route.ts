/**
 * GET /api/attendance/adjustments/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&contractorId=]
 * 정정 이력 엑셀 다운로드
 */
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

const ADJ_TYPE_LABEL: Record<string, string> = {
  CORRECTION: '정정',
  ADDITION:   '추가',
  DELETION:   '삭제',
  LEAVE:      '휴가',
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDt(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate');
  const endDate   = url.searchParams.get('endDate');
  const contractorIdParam = url.searchParams.get('contractorId');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  /* 업체 범위 결정 */
  let contractorIds: bigint[] | null = null;
  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ adjustments: [] });
    contractorIds = [BigInt(session.contractorId)];
  } else if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ adjustments: [] });
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), deletedAt: null },
      select: { id: true },
    });
    contractorIds = cs.map((c) => c.id);
    if (contractorIdParam) {
      const filtered = contractorIds.filter((id) => id.toString() === contractorIdParam);
      if (filtered.length > 0) contractorIds = filtered;
    }
  } else if (session.role === 'SUPER_ADMIN' && contractorIdParam) {
    contractorIds = [BigInt(contractorIdParam)];
  }

  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T23:59:59');

  const adjustments = await prisma.attendanceAdjustment.findMany({
    where: {
      record: {
        workDate: { gte: start, lte: end },
        ...(contractorIds ? { contractorId: { in: contractorIds } } : {}),
      },
    },
    orderBy: [{ record: { workDate: 'asc' } }, { createdAt: 'asc' }],
    include: {
      record: {
        select: {
          workDate: true,
          worker: { select: { name: true, employeeNo: true } },
        },
      },
    },
    take: 2000,
  });

  const adjusterIds = [...new Set(adjustments.map((a) => a.adjustedBy))];
  const adjusters   = await prisma.user.findMany({
    where: { id: { in: adjusterIds } },
    select: { id: true, name: true },
  });
  const adjMap = new Map(adjusters.map((u) => [u.id.toString(), u.name]));

  /* 엑셀 생성 */
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('근태 정정 이력');

  applyStandardHeader(ws, {
    title: '근태 정정 이력',
    colCount: 12,
    period: `${startDate} ~ ${endDate}`,
    totalCount: adjustments.length,
  });

  ws.getColumn(1).width  = 6;
  ws.getColumn(2).width  = 12;
  ws.getColumn(3).width  = 10;
  ws.getColumn(4).width  = 10;
  ws.getColumn(5).width  = 8;
  ws.getColumn(6).width  = 40;
  ws.getColumn(7).width  = 10;
  ws.getColumn(8).width  = 10;
  ws.getColumn(9).width  = 10;
  ws.getColumn(10).width = 10;
  ws.getColumn(11).width = 10;
  ws.getColumn(12).width = 18;

  addHeaderRow(ws, [
    'No', '날짜', '근로자', '사번', '유형', '사유',
    '출근(전)', '출근(후)', '퇴근(전)', '퇴근(후)', '정정자', '정정일시',
  ]);

  adjustments.forEach((a, i) => {
    const row = ws.addRow([
      i + 1,
      a.record.workDate.toISOString().slice(0, 10),
      a.record.worker.name,
      a.record.worker.employeeNo ?? '',
      ADJ_TYPE_LABEL[a.adjustmentType] ?? a.adjustmentType,
      a.reason,
      fmtTime(a.originalCheckIn?.toISOString() ?? null),
      fmtTime(a.adjustedCheckIn?.toISOString()  ?? null),
      fmtTime(a.originalCheckOut?.toISOString() ?? null),
      fmtTime(a.adjustedCheckOut?.toISOString() ?? null),
      adjMap.get(a.adjustedBy.toString()) ?? '',
      fmtDt(a.createdAt.toISOString()),
    ]);
    styleDataRow(row, i + 1);
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('근태정정이력'));
}
