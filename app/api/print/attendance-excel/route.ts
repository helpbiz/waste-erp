import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const ym = url.searchParams.get('ym') ?? new Date().toISOString().slice(0, 7);
  const [year, month] = ym.split('-').map(Number);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0);
  const daysInMonth = monthEnd.getDate();

  const [workers, records] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['WORKER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] }, status: 'ACTIVE', ...userScope(session) },
      select: { id: true, name: true, employeeNo: true, department: { select: { name: true } } },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.attendanceRecord.findMany({
      where: { ...contractorScopeWhere(session), workDate: { gte: monthStart, lte: monthEnd } },
      select: { workerId: true, workDate: true, checkInTime: true, checkOutTime: true },
    }),
  ]);

  type DayRec = { checkIn: string | null; checkOut: string | null };
  const map = new Map<string, Map<number, DayRec>>();
  for (const r of records) {
    const wid = r.workerId.toString();
    if (!map.has(wid)) map.set(wid, new Map());
    const fmt = (t: Date | null) => {
      if (!t) return null;
      const u = new Date(t.getTime() + 9 * 3600_000);
      return `${String(u.getUTCHours()).padStart(2, '0')}:${String(u.getUTCMinutes()).padStart(2, '0')}`;
    };
    map.get(wid)!.set(r.workDate.getDate(), { checkIn: fmt(r.checkInTime), checkOut: fmt(r.checkOutTime) });
  }

  const TOTAL_COLS = 4 + daysInMonth + 1; // No + 부서 + 성명 + 사번 + days + 출근일수

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Clean ERP';
  const ws = wb.addWorksheet(`${year}년${month}월`);

  /* ── 1행: 타이틀 ── */
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const t = ws.getCell(1, 1);
  t.value = `월별 출퇴근 현황 — ${year}년 ${month}월 · 총 ${workers.length}명`;
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  /* ── 2행: 헤더 ── */
  const hdrs: string[] = ['No', '부서', '성명', '사번'];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    hdrs.push(`${d}(${DAY_NAMES[dow]})`);
  }
  hdrs.push('출근일수');

  const hRow = ws.addRow(hdrs); // row 2
  hRow.font = { bold: true, size: 9 };
  hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  hRow.height = 22;
  hRow.eachCell((cell, col) => {
    const dow = col >= 5 && col <= 4 + daysInMonth
      ? new Date(year, month - 1, col - 4).getDay() : -1;
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: dow === 0 ? 'FFFEE2E2' : dow === 6 ? 'FFDBEAFE' : 'FFE2E8F0' },
    };
  });

  /* ── 데이터 행 ── */
  workers.forEach((w, idx) => {
    const dm = map.get(w.id.toString()) ?? new Map<number, DayRec>();
    const vals: (string | number)[] = [idx + 1, w.department?.name ?? '', w.name, w.employeeNo ?? ''];
    let cnt = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const rec = dm.get(d);
      if (rec?.checkIn) {
        vals.push(`${rec.checkIn}\n${rec.checkOut ?? '—'}`);
        cnt++;
      } else {
        vals.push('');
      }
    }
    vals.push(cnt);
    const row = ws.addRow(vals);
    row.font = { size: 9 };
    row.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    row.height = 28;
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  /* ── 열 너비 ── */
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 10;
  for (let d = 1; d <= daysInMonth; d++) ws.getColumn(4 + d).width = 9;
  ws.getColumn(4 + daysInMonth + 1).width = 8;

  /* ── 테두리 (헤더+데이터 전체) ── */
  const lastDataRow = 2 + workers.length;
  for (let r = 2; r <= lastDataRow; r++) {
    for (let c = 1; c <= TOTAL_COLS; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  /* ── 인쇄 설정 ── */
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = {
    oddHeader: `&C&B월별 출퇴근 현황 — ${year}년 ${month}월 · 총 ${workers.length}명`,
    oddFooter: '&R&P / &N',
  };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`월별출퇴근현황_${ym}`)}.xlsx`,
    },
  });
}
