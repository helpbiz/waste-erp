/**
 * GET /api/vehicle-logs/pdf?date=YYYY-MM-DD&vehicleId=N
 *
 * 1대 = 1페이지 고정 Puppeteer PDF 생성 + 서버 저장 (Option B)
 * 저장 경로: /app/storage/vehicle-pdfs/{date}/{contractorId}_{vehicleNo}_{date}.pdf
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { logger } from '@/lib/logger';
import { vehicleTypeLabel } from '@/lib/vehicle-types';
import { todayKstDate } from '@/lib/dates';
import { renderVehicleLogHtml } from '@/lib/vehicle-log/pdf-html';
import { renderPdf } from '@/lib/report/pdf-renderer';

const STORAGE_BASE = process.env.PDF_STORAGE_PATH ?? '/app/storage/vehicle-pdfs';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FUEL_LABEL: Record<string, string> = {
  DIESEL: '경유', LPG: 'LPG', ELECTRIC: '전기', CNG: 'CNG', GASOLINE: '휘발유',
};

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const dateStr = url.searchParams.get('date') ?? todayKstDate().toISOString().slice(0, 10);
  const vehicleIdParam = url.searchParams.get('vehicleId');

  if (!DATE_RE.test(dateStr)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }

  const date = new Date(dateStr);
  const logWhere = {
    ...vehicleLogWhere(session),
    logDate: date,
    ...(vehicleIdParam ? { vehicleId: BigInt(vehicleIdParam) } : {}),
  };

  try {
    const logs = await prisma.vehicleLog.findMany({
      where: logWhere,
      include: {
        vehicle: {
          select: {
            vehicleNo: true, vehicleType: true, vehicleTon: true, fuelType: true,
            contractor: { select: { companyName: true } },
          },
        },
        driver: { select: { name: true, employeeNo: true } },
        zone: { select: { zoneName: true } },
      },
      orderBy: [{ vehicleId: 'asc' }, { id: 'asc' }],
      take: 200,
    });

    if (logs.length === 0) {
      return NextResponse.json({ error: 'no_logs', message: '출력할 운행일지가 없습니다.' }, { status: 404 });
    }

    const logData = logs.map((l) => ({
      id: l.id.toString(),
      logDate: l.logDate.toISOString().slice(0, 10),
      vehicleNo: l.vehicle.vehicleNo,
      vehicleType: vehicleTypeLabel(l.vehicle.vehicleType),
      vehicleTon: l.vehicle.vehicleTon,
      contractorName: l.vehicle.contractor?.companyName ?? null,
      driverName: l.driver.name,
      driverEmployeeNo: l.driver.employeeNo,
      zoneName: l.zone?.zoneName ?? null,
      startMileage: l.startMileage,
      endMileage: l.endMileage,
      fuelUsed: l.fuelUsed ? Number(l.fuelUsed) : null,
      fuelTypeName: FUEL_LABEL[l.vehicle.fuelType] ?? l.vehicle.fuelType,
      wasteWeightKg: l.wasteWeightKg ? Number(l.wasteWeightKg) : null,
      tripCount: l.tripCount,
      routeDetail: l.routeDetail,
      status: l.status,
    }));

    /* HTML → Puppeteer PDF (portrait, 1대=1페이지 고정) */
    const html = await renderVehicleLogHtml(logData);
    const pdfBuffer = await renderPdf(html, { landscape: false, margin: '0' });

    /* 파일 저장 */
    const contractorIdStr = session.contractorId ?? '0';
    const vehicleNoSuffix = vehicleIdParam && logs[0]
      ? `_${logs[0].vehicle.vehicleNo.replace(/\s/g, '')}` : '_전체';
    const filename = `${contractorIdStr}${vehicleNoSuffix}_${dateStr}.pdf`;
    const dirPath = path.join(STORAGE_BASE, dateStr);
    const filePath = path.join(dirPath, filename);

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);

    /* DB 보관 이력 */
    if (session.contractorId) {
      await prisma.vehiclePdfArchive.create({
        data: {
          contractorId: BigInt(session.contractorId),
          logDate: date,
          vehicleId: vehicleIdParam ? BigInt(vehicleIdParam) : null,
          vehicleNo: vehicleIdParam && logs[0] ? logs[0].vehicle.vehicleNo : null,
          filePath: filePath.replace(STORAGE_BASE, ''),
          fileSize: pdfBuffer.length,
          pageCount: logs.length,
          createdBy: BigInt(session.userId),
        },
      }).catch((err) => logger.error('vehicle_pdf_archive_write_failed', { date: dateStr }, err));
    }

    /* 감사 로그 */
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'REPORT_DOWNLOAD',
        resourceType: 'vehicle_pdf',
        resourceId: `${dateStr}${vehicleNoSuffix}`,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: { date: dateStr, vehicleId: vehicleIdParam, pages: logs.length } as object,
      },
    }).catch((err) => logger.error('audit_log_write_failed', { action: 'REPORT_DOWNLOAD', resourceType: 'vehicle_pdf' }, err));

    const downloadName = `차량운행일지${vehicleNoSuffix}_${dateStr}.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    logger.error('vehicle_pdf_generation_failed', { date: dateStr, vehicleId: vehicleIdParam }, err instanceof Error ? err : new Error(msg));
    return NextResponse.json({ error: 'pdf_generation_failed', message: msg }, { status: 500 });
  }
}
