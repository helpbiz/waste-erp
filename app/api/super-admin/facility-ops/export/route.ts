/**
 * GET /api/super-admin/facility-ops/export — AVAC 운전기록 Excel 다운로드
 *   query: ?facilityId=N&from=YYYY-MM-DD&to=YYYY-MM-DD (최대 90일)
 */
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

const MAX_DAYS = 90;

async function resolveMunicipalityId(session: {
  role: string;
  contractorId: string | null;
}): Promise<bigint | null | 'all'> {
  if (session.role === 'SUPER_ADMIN') return 'all';
  if (session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true },
    });
    return c?.municipalityId ?? null;
  }
  return null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const facilityId = url.searchParams.get('facilityId');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
  if (diffDays > MAX_DAYS) {
    return NextResponse.json({ error: `기간은 최대 ${MAX_DAYS}일까지 조회 가능합니다` }, { status: 400 });
  }

  const muniId = await resolveMunicipalityId(session);
  if (muniId === null) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const items = await prisma.facilityDailyOps.findMany({
    where: {
      ...(facilityId ? { facilityId: BigInt(facilityId) } : {}),
      ...(muniId !== 'all' ? { facility: { municipalityId: muniId } } : {}),
      opsDate: { gte: fromDate, lte: toDate },
    },
    include: { facility: { select: { name: true } } },
    orderBy: [{ opsDate: 'asc' }, { facilityId: 'asc' }],
  });

  const period = `${from} ~ ${to}`;
  const COL_HEADERS = [
    '집하장', '운영일자', '일반가동(h)', '음식가동(h)', '비가동(h)',
    '일반처리(t)', '음식처리(t)', '일반수거(t)', '음식수거(t)',
    '일반반출(t)', '음식반출(t)', '전일전력(kWh)',
  ];
  const COL_WIDTHS = [20, 14, 14, 14, 12, 14, 14, 14, 14, 14, 14, 16];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  /* 1) 상세 시트 */
  const ws1 = wb.addWorksheet('상세');
  applyStandardHeader(ws1, { title: '집하장 운전기록 현황 (상세)', colCount: 12, period, totalCount: items.length });
  addHeaderRow(ws1, COL_HEADERS);

  items.forEach((r, idx) => {
    const row = ws1.addRow([
      r.facility.name,
      r.opsDate.toISOString().slice(0, 10),
      Number(r.generalOpHours),
      Number(r.foodOpHours),
      Number(r.downtimeHours),
      Number(r.generalWasteTon),
      Number(r.foodWasteTon),
      Number(r.generalCollectTon),
      Number(r.foodCollectTon),
      Number(r.generalTransferTon),
      Number(r.foodTransferTon),
      Number(r.prevDayPowerKwh),
    ]);
    styleDataRow(row, idx + 1);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 9 };
      cell.alignment = { horizontal: colNum <= 2 ? 'center' : 'right', vertical: 'middle' };
    });
  });
  ws1.columns = COL_WIDTHS.map((width) => ({ width }));

  /* 2) 집하장별 합계 */
  const byFacility = new Map<string, {
    days: number; generalOpHours: number; foodOpHours: number; downtimeHours: number;
    generalWasteTon: number; foodWasteTon: number; generalCollectTon: number; foodCollectTon: number;
    generalTransferTon: number; foodTransferTon: number; prevDayPowerKwh: number;
  }>();
  for (const r of items) {
    const k = r.facility.name;
    const cur = byFacility.get(k) ?? {
      days: 0, generalOpHours: 0, foodOpHours: 0, downtimeHours: 0,
      generalWasteTon: 0, foodWasteTon: 0, generalCollectTon: 0, foodCollectTon: 0,
      generalTransferTon: 0, foodTransferTon: 0, prevDayPowerKwh: 0,
    };
    byFacility.set(k, {
      days: cur.days + 1,
      generalOpHours: cur.generalOpHours + Number(r.generalOpHours),
      foodOpHours: cur.foodOpHours + Number(r.foodOpHours),
      downtimeHours: cur.downtimeHours + Number(r.downtimeHours),
      generalWasteTon: cur.generalWasteTon + Number(r.generalWasteTon),
      foodWasteTon: cur.foodWasteTon + Number(r.foodWasteTon),
      generalCollectTon: cur.generalCollectTon + Number(r.generalCollectTon),
      foodCollectTon: cur.foodCollectTon + Number(r.foodCollectTon),
      generalTransferTon: cur.generalTransferTon + Number(r.generalTransferTon),
      foodTransferTon: cur.foodTransferTon + Number(r.foodTransferTon),
      prevDayPowerKwh: cur.prevDayPowerKwh + Number(r.prevDayPowerKwh),
    });
  }

  const ws2 = wb.addWorksheet('집하장별합계');
  applyStandardHeader(ws2, { title: '집하장 운전기록 현황 (집하장별 합계)', colCount: 12, period, totalCount: byFacility.size, unit: '개소' });
  addHeaderRow(ws2, ['집하장', '일수', ...COL_HEADERS.slice(2)]);
  [...byFacility.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([facility, v], idx) => {
    const row = ws2.addRow([
      facility, v.days,
      v.generalOpHours, v.foodOpHours, v.downtimeHours,
      v.generalWasteTon, v.foodWasteTon, v.generalCollectTon, v.foodCollectTon,
      v.generalTransferTon, v.foodTransferTon, v.prevDayPowerKwh,
    ]);
    styleDataRow(row, idx + 1);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 9 };
      cell.alignment = { horizontal: colNum <= 2 ? 'center' : 'right', vertical: 'middle' };
    });
  });
  ws2.columns = [{ width: 20 }, { width: 8 }, ...COL_WIDTHS.slice(2).map((width) => ({ width }))];

  /* 3) 전체 합계 */
  function sum(key: keyof (typeof items)[0]) {
    return items.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
  }

  const ws3 = wb.addWorksheet('전체합계');
  applyStandardHeader(ws3, { title: '집하장 운전기록 현황 (전체 합계)', colCount: 3, period, totalCount: items.length });
  addHeaderRow(ws3, ['항목', '합계', '단위']);
  const summaryRows: [string, string | number, string][] = [
    ['집하장 수', byFacility.size, '개'],
    ['일반 가동시간 합계', sum('generalOpHours').toFixed(2), 'h'],
    ['음식 가동시간 합계', sum('foodOpHours').toFixed(2), 'h'],
    ['비가동시간 합계', sum('downtimeHours').toFixed(2), 'h'],
    ['일반 처리량 합계', sum('generalWasteTon').toFixed(3), 't'],
    ['음식 처리량 합계', sum('foodWasteTon').toFixed(3), 't'],
    ['일반 수거량 합계', sum('generalCollectTon').toFixed(3), 't'],
    ['음식 수거량 합계', sum('foodCollectTon').toFixed(3), 't'],
    ['일반 반출량 합계', sum('generalTransferTon').toFixed(3), 't'],
    ['음식 반출량 합계', sum('foodTransferTon').toFixed(3), 't'],
    ['전력 사용량 합계', sum('prevDayPowerKwh').toFixed(2), 'kWh'],
  ];
  summaryRows.forEach((r, idx) => {
    const row = ws3.addRow(r);
    styleDataRow(row, idx + 1);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '맑은 고딕', size: 9 };
    });
  });
  ws3.columns = [{ width: 22 }, { width: 16 }, { width: 8 }];

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('집하장운전기록'));
}
