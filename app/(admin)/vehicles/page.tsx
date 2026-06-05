import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { vehicleWhere, vehicleLogWhere, isVehicleLogManager } from '@/lib/vehicle-logs';
import { todayKstDate } from '@/lib/dates';
import VehiclesClient, { type LogRow, type VehicleRow } from './_vehicles-client';

export const dynamic = 'force-dynamic';

export default async function VehiclesPage({ searchParams }: { searchParams: { date?: string } }) {
  const session = (await readSession())!;
  const today = todayKstDate();

  /* 날짜 파라미터 처리 — 없으면 오늘 */
  const rawDate = searchParams.date;
  const selectedDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(rawDate)
    : today;
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);

  const [vehicles, logs, workers] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhere(session),
      orderBy: { vehicleNo: 'asc' },
      include: {
        logs: { where: { logDate: today }, take: 1, orderBy: { id: 'desc' } },
        driver: { select: { id: true, name: true } },
        passenger1: { select: { id: true, name: true } },
        passenger2: { select: { id: true, name: true } },
      },
    }),
    prisma.vehicleLog.findMany({
      where: { logDate: selectedDate, ...vehicleLogWhere(session) },
      orderBy: [{ status: 'asc' }, { id: 'desc' }],
      include: {
        vehicle: { select: { vehicleNo: true, vehicleType: true, vehicleTon: true, fuelType: true } },
        driver: { select: { name: true } },
      },
    }),
    /* 본인 위탁업체 WORKER 목록 — 운전자 dropdown */
    session.contractorId
      ? prisma.user.findMany({
          where: { role: 'WORKER', status: 'ACTIVE', contractorId: BigInt(session.contractorId) },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const vehicleRows: VehicleRow[] = vehicles.map((v) => {
    const todayLog = v.logs[0];
    return {
      id: v.id.toString(),
      vehicleNo: v.vehicleNo,
      vehicleType: v.vehicleType,
      vehicleTon: v.vehicleTon,
      capacityTon: v.capacityTon ? Number(v.capacityTon) : null,
      fuelType: v.fuelType,
      yearManufactured: v.yearManufactured,
      registrationDate: v.registrationDate?.toISOString().slice(0, 10) ?? null,
      status: v.status,
      driverId: v.driverId?.toString() ?? null,
      driverName: v.driver?.name ?? null,
      passenger1Id: v.passenger1Id?.toString() ?? null,
      passenger1Name: v.passenger1?.name ?? null,
      passenger2Id: v.passenger2Id?.toString() ?? null,
      passenger2Name: v.passenger2?.name ?? null,
      operationStartDate: v.operationStartDate?.toISOString().slice(0, 10) ?? null,
      initialMileage: v.initialMileage,
      totalMileage: v.totalMileage,
      logStatus: todayLog?.status ?? null,
      wasteWeightKg: todayLog?.wasteWeightKg ? Number(todayLog.wasteWeightKg) : null,
    };
  });

  const logRows: LogRow[] = logs.map((l) => ({
    id: l.id.toString(),
    status: l.status,
    vehicleNo: l.vehicle.vehicleNo,
    vehicleType: l.vehicle.vehicleType,
    vehicleTon: l.vehicle.vehicleTon,
    fuelType: l.vehicle.fuelType,
    driverName: l.driver.name,
    startMileage: l.startMileage,
    endMileage: l.endMileage,
    fuelUsed: l.fuelUsed ? Number(l.fuelUsed) : null,
    wasteWeightKg: l.wasteWeightKg ? Number(l.wasteWeightKg) : null,
    tripCount: l.tripCount,
    routeDetail: l.routeDetail,
  }));

  return (
    <VehiclesClient
      vehicles={vehicleRows}
      logs={logRows}
      workers={workers.map((w) => ({ id: w.id.toString(), name: w.name }))}
      isManager={isVehicleLogManager(session.role)}
      todayLabel={today.toISOString().slice(0, 10)}
      selectedDate={selectedDateStr}
    />
  );
}
