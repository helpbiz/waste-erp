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
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

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
      vehicle: { select: { vehicleNo: true, vehicleType: true, vehicleTon: true, contractor: { select: { companyName: true } } } },
      zone: { select: { zoneName: true } },
    },
  });

  const period = from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '전체';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('차량일지');

  // 표준 헤더 (1~3행)
  applyStandardHeader(ws, {
    title: '차량일지',
    colCount: 14,
    period,
    totalCount: logs.length,
  });

  // 4행: 컬럼 헤더 — 업체명 첫 컬럼 추가
  addHeaderRow(ws, [
    '업체명', '일자', '차량번호', '차종', '톤급', '운전자', '구역', '상태',
    '시작계기(km)', '종료계기(km)', '주행거리(km)', '주유량(L)', '수거량(kg)', '운행횟수',
  ]);

  // 5행~: 데이터
  logs.forEach((l, idx) => {
    const v = l as typeof l & { vehicle: { vehicleNo: string; vehicleType: string; vehicleTon: string | null } };
    const d = l as typeof l & { driver: { name: string } };
    const z = l as typeof l & { zone: { zoneName: string } | null };
    const dist = (l.startMileage != null && l.endMileage != null)
      ? (Number(l.endMileage) - Number(l.startMileage))
      : null;

    const row = ws.addRow([
      (v.vehicle as { contractor?: { companyName: string } }).contractor?.companyName ?? '',
      l.logDate.toISOString().slice(0, 10),
      v.vehicle.vehicleNo,
      v.vehicle.vehicleType,
      v.vehicle.vehicleTon ?? '',
      d.driver.name,
      z.zone?.zoneName ?? '',
      STATUS_LABEL[l.status] ?? l.status,
      l.startMileage != null ? Number(l.startMileage) : null,
      l.endMileage != null ? Number(l.endMileage) : null,
      dist,
      l.fuelUsed != null ? Number(l.fuelUsed) : null,
      l.wasteWeightKg != null ? Number(l.wasteWeightKg) : null,
      l.tripCount,
    ]);
    styleDataRow(row, idx + 1);
    row.height = 18;
    // 숫자 컬럼 오른쪽 정렬 (업체명 추가로 1열씩 우측 이동)
    [9, 10, 11, 12, 13, 14].forEach((col) => {
      row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  ws.getColumn(9).numFmt  = '#,##0';
  ws.getColumn(10).numFmt = '#,##0';
  ws.getColumn(11).numFmt = '#,##0';
  ws.getColumn(12).numFmt = '#,##0.0';
  ws.getColumn(13).numFmt = '#,##0';

  ws.columns = [
    { width: 20 }, // 업체명
    { width: 13 }, // 일자
    { width: 14 }, // 차량번호
    { width: 10 }, // 차종
    { width: 8 },  // 톤급
    { width: 10 }, // 운전자
    { width: 12 }, // 구역
    { width: 10 }, // 상태
    { width: 14 }, // 시작계기
    { width: 14 }, // 종료계기
    { width: 14 }, // 주행거리
    { width: 12 }, // 주유량
    { width: 12 }, // 수거량
    { width: 10 }, // 운행횟수
  ];

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('차량일지'));
}
