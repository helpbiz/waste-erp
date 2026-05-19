/**
 * GET /api/tbm/education-stats/export?year=YYYY
 * 교육시간현황 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }

  const contractorId = BigInt(session.contractorId);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const signatures = await prisma.tbmSignature.findMany({
    where: {
      session: { contractorId, sessionDate: { gte: from, lt: to } },
    },
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
          position: { select: { label: true } },
        },
      },
    },
  });

  const totalSessions = await prisma.tbmSession.count({
    where: { contractorId, sessionDate: { gte: from, lt: to } },
  });

  const map = new Map<string, {
    name: string; department: string | null; position: string | null;
    count: number; minutes: number;
  }>();
  for (const sig of signatures) {
    const wid = sig.worker.id.toString();
    const existing = map.get(wid);
    if (existing) {
      existing.count += 1;
      existing.minutes += 10;
    } else {
      map.set(wid, {
        name: sig.worker.name,
        department: sig.worker.department?.name ?? null,
        position: sig.worker.position?.label ?? null,
        count: 1,
        minutes: 10,
      });
    }
  }

  const workers = Array.from(map.values()).sort((a, b) => b.count - a.count);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WCI-ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('교육시간현황');
  const period = `${year}년 1월 1일 ~ ${year}년 12월 31일  |  TBM 횟수: ${totalSessions}회 · 대상 인원: ${workers.length}명`;

  // 표준 헤더 (1~3행)
  applyStandardHeader(ws, {
    title: '교육시간 현황',
    colCount: 6,
    period,
    totalCount: workers.length,
    unit: '명',
  });

  // 4행: 컬럼 헤더
  addHeaderRow(ws, ['순번', '성명', '담당(부서)', '직급', '참석횟수', '교육시간(분)']);

  // 5행~: 데이터
  workers.forEach((w, idx) => {
    const row = ws.addRow([
      idx + 1, w.name, w.department ?? '', w.position ?? '', w.count, w.minutes,
    ]);
    styleDataRow(row, idx + 1);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 10 };
      if (colNum === 1 || colNum >= 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // 합계 행
  if (workers.length > 0) {
    const totalRow = ws.addRow([
      '', '합계', '', '',
      workers.reduce((s, w) => s + w.count, 0),
      workers.reduce((s, w) => s + w.minutes, 0),
    ]);
    totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF2E5DA8' } },
        bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
      };
      cell.alignment = { horizontal: colNum === 1 || colNum >= 5 ? 'center' : 'left', vertical: 'middle' };
    });
    totalRow.height = 22;
  }

  ws.columns = [
    { width: 8 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 14 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return xlsxResponse(Buffer.from(buffer), makeFilename('교육시간현황'));
}
