/**
 * GET /api/super-admin/facility-ops/export — AVAC 운전기록 Excel 다운로드
 *   query: ?facilityId=N&from=YYYY-MM-DD&to=YYYY-MM-DD (최대 90일)
 *
 * Design Ref: §3.3 — exceljs Buffer → Response. Streamlit avac_export_service 대체.
 * Plan SC: FR-07, FR-08 (Excel 컬럼 12개)
 */
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_DAYS = 90;

// Design Ref: §5 — CONTRACTOR_ADMIN 시설 접근 제어
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

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  const COLS: ExcelJS.Column[] = [
    { header: '집하장', key: 'facility', width: 20 },
    { header: '운영일자', key: 'opsDate', width: 14 },
    { header: '일반가동(h)', key: 'generalOpHours', width: 14 },
    { header: '음식가동(h)', key: 'foodOpHours', width: 14 },
    { header: '비가동(h)', key: 'downtimeHours', width: 12 },
    { header: '일반처리(t)', key: 'generalWasteTon', width: 14 },
    { header: '음식처리(t)', key: 'foodWasteTon', width: 14 },
    { header: '일반수거(t)', key: 'generalCollectTon', width: 14 },
    { header: '음식수거(t)', key: 'foodCollectTon', width: 14 },
    { header: '일반반출(t)', key: 'generalTransferTon', width: 14 },
    { header: '음식반출(t)', key: 'foodTransferTon', width: 14 },
    { header: '전일전력(kWh)', key: 'prevDayPowerKwh', width: 16 },
  ] as ExcelJS.Column[];

  // ── Sheet 1: 상세 (일별 × 집하장) ──────────────────────────────
  const ws1 = wb.addWorksheet('상세');
  ws1.columns = COLS;
  ws1.getRow(1).font = { bold: true };

  for (const r of items) {
    ws1.addRow({
      facility: r.facility.name,
      opsDate: r.opsDate.toISOString().slice(0, 10),
      generalOpHours: Number(r.generalOpHours),
      foodOpHours: Number(r.foodOpHours),
      downtimeHours: Number(r.downtimeHours),
      generalWasteTon: Number(r.generalWasteTon),
      foodWasteTon: Number(r.foodWasteTon),
      generalCollectTon: Number(r.generalCollectTon),
      foodCollectTon: Number(r.foodCollectTon),
      generalTransferTon: Number(r.generalTransferTon),
      foodTransferTon: Number(r.foodTransferTon),
      prevDayPowerKwh: Number(r.prevDayPowerKwh),
    });
  }

  // ── Sheet 2: 집하장별 합계 ──────────────────────────────────────
  const ws2 = wb.addWorksheet('집하장별합계');
  ws2.columns = [
    { header: '집하장', key: 'facility', width: 20 },
    { header: '일수', key: 'days', width: 8 },
    { header: '일반가동(h)', key: 'generalOpHours', width: 14 },
    { header: '음식가동(h)', key: 'foodOpHours', width: 14 },
    { header: '비가동(h)', key: 'downtimeHours', width: 12 },
    { header: '일반처리(t)', key: 'generalWasteTon', width: 14 },
    { header: '음식처리(t)', key: 'foodWasteTon', width: 14 },
    { header: '일반수거(t)', key: 'generalCollectTon', width: 14 },
    { header: '음식수거(t)', key: 'foodCollectTon', width: 14 },
    { header: '일반반출(t)', key: 'generalTransferTon', width: 14 },
    { header: '음식반출(t)', key: 'foodTransferTon', width: 14 },
    { header: '전일전력(kWh)', key: 'prevDayPowerKwh', width: 16 },
  ] as ExcelJS.Column[];
  ws2.getRow(1).font = { bold: true };

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

  for (const [facility, v] of [...byFacility.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    ws2.addRow({ facility, ...v });
  }

  // ── Sheet 3: 전체 합계 ──────────────────────────────────────────
  const ws3 = wb.addWorksheet('전체합계');
  ws3.columns = [
    { header: '항목', key: 'label', width: 18 },
    { header: '합계', key: 'value', width: 16 },
    { header: '단위', key: 'unit', width: 8 },
  ] as ExcelJS.Column[];
  ws3.getRow(1).font = { bold: true };

  function sum(key: keyof typeof items[0]) {
    return items.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
  }

  ws3.addRow({ label: '조회 기간', value: `${from} ~ ${to}`, unit: '' });
  ws3.addRow({ label: '집하장 수', value: byFacility.size, unit: '개' });
  ws3.addRow({ label: '데이터 일수', value: items.length, unit: '건' });
  ws3.addRow({});
  ws3.addRow({ label: '일반 가동시간 합계', value: sum('generalOpHours').toFixed(2), unit: 'h' });
  ws3.addRow({ label: '음식 가동시간 합계', value: sum('foodOpHours').toFixed(2), unit: 'h' });
  ws3.addRow({ label: '비가동시간 합계', value: sum('downtimeHours').toFixed(2), unit: 'h' });
  ws3.addRow({ label: '일반 처리량 합계', value: sum('generalWasteTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '음식 처리량 합계', value: sum('foodWasteTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '일반 수거량 합계', value: sum('generalCollectTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '음식 수거량 합계', value: sum('foodCollectTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '일반 반출량 합계', value: sum('generalTransferTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '음식 반출량 합계', value: sum('foodTransferTon').toFixed(3), unit: 't' });
  ws3.addRow({ label: '전력 사용량 합계', value: sum('prevDayPowerKwh').toFixed(2), unit: 'kWh' });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const fromLabel = from.replace(/-/g, '');
  const toLabel = to.replace(/-/g, '');

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="facility_ops_${fromLabel}_${toLabel}.xlsx"`,
      'content-length': String(buf.length),
    },
  });
}
