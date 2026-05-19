/**
 * 차량 운행일지 출력 페이지
 *  ?date=YYYY-MM-DD&vehicleId=N (선택)
 *  - 가시범위 차량의 해당 날짜 운행일지 일괄/단건 출력
 */
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { vehicleWhere, vehicleLogWhere } from '@/lib/vehicle-logs';
import { vehicleTypeLabel } from '@/lib/vehicle-types';
import { todayKstDate } from '@/lib/dates';
import VehiclePrintClient from './_print-client';

export const dynamic = 'force-dynamic';

export default async function VehiclePrintPage({ searchParams }: { searchParams: { date?: string; vehicleId?: string } }) {
  const session = (await readSession())!;
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const dateStr = searchParams.date ?? todayKstDate().toISOString().slice(0, 10);
  const date = new Date(dateStr);
  const vehicleId = searchParams.vehicleId;

  const logs = await prisma.vehicleLog.findMany({
    where: {
      ...vehicleLogWhere(session),
      logDate: date,
      ...(vehicleId ? { vehicleId: BigInt(vehicleId) } : {}),
    },
    include: {
      vehicle: { select: { vehicleNo: true, vehicleType: true, vehicleTon: true, contractor: { select: { companyName: true } } } },
      driver: { select: { name: true, employeeNo: true } },
      zone: { select: { zoneName: true } },
    },
    orderBy: [{ vehicleId: 'asc' }],
    take: 30,
  });

  /* 차량 목록 (단건 선택용 — 가시범위 모든 차량) */
  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere(session),
    select: { id: true, vehicleNo: true, vehicleType: true },
    orderBy: { vehicleNo: 'asc' },
  });

  return (
    <VehiclePrintClient
      date={dateStr}
      selectedVehicleId={vehicleId ?? null}
      isSuperAdmin={isSuperAdmin}
      vehicles={vehicles.map((v) => ({ id: v.id.toString(), vehicleNo: v.vehicleNo, type: vehicleTypeLabel(v.vehicleType) }))}
      logs={logs.map((l) => ({
        id: l.id.toString(),
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
        wasteWeightKg: l.wasteWeightKg ? Number(l.wasteWeightKg) : null,
        tripCount: l.tripCount,
        routeDetail: l.routeDetail,
        status: l.status,
      }))}
    />
  );
}
