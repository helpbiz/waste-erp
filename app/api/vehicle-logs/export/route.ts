/**
 * GET /api/vehicle-logs/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...
 * 차량일지 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중', SUBMITTED: '제출됨', APPROVED: '승인완료',
};

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const statusParam = url.searchParams.get('status');

  const base = vehicleLogWhere(session);

  const where: Prisma.VehicleLogWhereInput = {
    ...base,
    ...(from || to ? {
      logDate: {
        ...(from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? { gte: new Date(from + 'T00:00:00.000Z') } : {}),
        ...(to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? { lte: new Date(to + 'T00:00:00.000Z') } : {}),
      },
    } : {}),
    ...(['DRAFT', 'SUBMITTED', 'APPROVED'].includes(statusParam ?? '')
      ? { status: statusParam as 'DRAFT' | 'SUBMITTED' | 'APPROVED' }
      : {}),
  };

  const logs = await prisma.vehicleLog.findMany({
    where,
    orderBy: [{ logDate: 'asc' }, { id: 'asc' }],
    take: 2000,
    include: {
      driver: { select: { name: true } },
      vehicle: { select: { vehicleNo: true, vehicleType: true, vehicleTon: true } },
      zone: { select: { zoneName: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('차량일지');

  ws.columns = [
    { header: '일자', key: 'logDate', width: 13 },
    { header: '차량번호', key: 'vehicleNo', width: 14 },
    { header: '차종', key: 'vehicleType', width: 10 },
    { header: '톤급', key: 'tonClass', width: 8 },
    { header: '운전자', key: 'driverName', width: 10 },
    { header: '구역', key: 'zoneName', width: 12 },
    { header: '상태', key: 'status', width: 10 },
    { header: '시작계기(km)', key: 'startMileage', width: 14 },
    { header: '종료계기(km)', key: 'endMileage', width: 14 },
    { header: '주행거리(km)', key: 'distance', width: 14 },
    { header: '주유량(L)', key: 'fuelUsed', width: 12 },
    { header: '수거량(kg)', key: 'wasteWeightKg', width: 12 },
    { header: '운행횟수', key: 'tripCount', width: 10 },
  ];

  // 헤더 스타일
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5F7C' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(1).height = 20;

  for (const l of logs) {
    const dist = (l.startMileage != null && l.endMileage != null)
      ? (Number(l.endMileage) - Number(l.startMileage))
      : null;

    ws.addRow({
      logDate: l.logDate.toISOString().slice(0, 10),
      vehicleNo: (l as typeof l & { vehicle: { vehicleNo: string; vehicleType: string; vehicleTon: string | null } }).vehicle.vehicleNo,
      vehicleType: (l as typeof l & { vehicle: { vehicleType: string } }).vehicle.vehicleType,
      tonClass: (l as typeof l & { vehicle: { vehicleTon: string | null } }).vehicle.vehicleTon ?? '',
      driverName: (l as typeof l & { driver: { name: string } }).driver.name,
      zoneName: (l as typeof l & { zone: { zoneName: string } | null }).zone?.zoneName ?? '',
      status: STATUS_LABEL[l.status] ?? l.status,
      startMileage: l.startMileage != null ? Number(l.startMileage) : null,
      endMileage: l.endMileage != null ? Number(l.endMileage) : null,
      distance: dist,
      fuelUsed: l.fuelUsed != null ? Number(l.fuelUsed) : null,
      wasteWeightKg: l.wasteWeightKg != null ? Number(l.wasteWeightKg) : null,
      tripCount: l.tripCount,
    });
  }

  // 숫자 컬럼 포맷
  ws.getColumn('startMileage').numFmt = '#,##0';
  ws.getColumn('endMileage').numFmt = '#,##0';
  ws.getColumn('distance').numFmt = '#,##0';
  ws.getColumn('fuelUsed').numFmt = '#,##0.0';
  ws.getColumn('wasteWeightKg').numFmt = '#,##0';

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    if (rowNum % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const label = from && to ? `${from}_${to}` : new Date().toISOString().slice(0, 10);

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="vehicle-logs_${label}.xlsx"`,
    },
  });
}
