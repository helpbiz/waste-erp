/**
 * GET /api/tbm/education-stats/export?year=YYYY
 * 교육시간현황 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import ExcelJS from 'exceljs';

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
      session: {
        contractorId,
        sessionDate: { gte: from, lt: to },
      },
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

  // Build Excel
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WCI-ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('교육시간현황');

  // ─── Title ───
  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '교육시간 현황';
  titleCell.font = { name: '맑은 고딕', bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // ─── Period ───
  ws.mergeCells('A2:F2');
  const periodCell = ws.getCell('A2');
  periodCell.value = `조회기간: ${year}년 1월 1일 ~ ${year}년 12월 31일`;
  periodCell.font = { name: '맑은 고딕', size: 10 };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // ─── Summary ───
  ws.mergeCells('A3:F3');
  const sumCell = ws.getCell('A3');
  sumCell.value = `총 TBM 횟수: ${totalSessions}회  |  참여 인원: ${workers.length}명  |  교육시간 기준: 1회 = 10분`;
  sumCell.font = { name: '맑은 고딕', size: 9, italic: true };
  sumCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 18;

  ws.addRow([]); // spacer row 4

  // ─── Header ───
  const headers = ['순번', '성명', '담당(부서)', '직급', '참석횟수', '교육시간(분)'];
  const headerRow = ws.addRow(headers); // row 5
  headerRow.eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5DA8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  ws.getRow(5).height = 28;

  // ─── Data rows ───
  workers.forEach((w, idx) => {
    const row = ws.addRow([
      idx + 1,
      w.name,
      w.department ?? '',
      w.position ?? '',
      w.count,
      w.minutes,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
      if (colNum === 1 || colNum >= 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
      }
    });
    row.height = 20;
  });

  // ─── Total row ───
  if (workers.length > 0) {
    const totalRow = ws.addRow([
      '',
      '합계',
      '',
      '',
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

  // ─── Column widths ───
  ws.columns = [
    { width: 8 },  // 순번
    { width: 14 }, // 성명
    { width: 18 }, // 부서
    { width: 14 }, // 직급
    { width: 12 }, // 참석횟수
    { width: 14 }, // 교육시간
  ];

  // ─── Note ───
  const noteRowIdx = 5 + workers.length + (workers.length > 0 ? 2 : 1);
  ws.mergeCells(`A${noteRowIdx}:F${noteRowIdx}`);
  const noteCell = ws.getCell(`A${noteRowIdx}`);
  noteCell.value = `출력일시: ${new Date().toLocaleString('ko-KR')}`;
  noteCell.font = { name: '맑은 고딕', size: 8, color: { argb: 'FF888888' } };
  noteCell.alignment = { horizontal: 'right' };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `교육시간현황_${year}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
