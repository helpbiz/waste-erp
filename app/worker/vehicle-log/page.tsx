import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import VehicleLogClient from './_vehicle-log-client';

export const dynamic = 'force-dynamic';

export default async function VehicleLogPage() {
  const session = await readSession();
  if (!session || session.role !== 'WORKER') redirect('/login');

  if (!session.contractorId) {
    return (
      <div className="p-6 text-sm text-red-600 font-bold">
        소속 업체가 없습니다. 관리자에게 문의하세요.
      </div>
    );
  }

  const [vehicles, lastLog, assignedVehicle, coworkers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { contractorId: BigInt(session.contractorId), status: { not: 'RETIRED' } },
      orderBy: { vehicleNo: 'asc' },
      select: { id: true, vehicleNo: true, vehicleType: true, vehicleTon: true, fuelType: true, totalMileage: true },
    }),
    prisma.vehicleLog.findFirst({
      where: { driverId: BigInt(session.userId) },
      orderBy: { logDate: 'desc' },
      select: { vehicleId: true, endMileage: true },
    }),
    prisma.vehicle.findFirst({
      where: { driverId: BigInt(session.userId), status: { not: 'RETIRED' } },
      select: { id: true },
    }),
    /* 동승자 후보 — 같은 업체 활성 워커 (본인 제외) */
    prisma.user.findMany({
      where: {
        contractorId: BigInt(session.contractorId),
        role: 'WORKER',
        status: 'ACTIVE',
        id: { not: BigInt(session.userId) },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const defaultVehicleId =
    assignedVehicle?.id.toString() ??
    lastLog?.vehicleId.toString() ??
    vehicles[0]?.id.toString() ??
    null;

  return (
    <VehicleLogClient
      vehicles={vehicles.map((v) => ({
        id: v.id.toString(),
        vehicleNo: v.vehicleNo,
        vehicleType: v.vehicleType,
        vehicleTon: v.vehicleTon ?? null,
        fuelType: v.fuelType,
        totalMileage: v.totalMileage ?? null,
      }))}
      coworkers={coworkers.map((w) => ({ id: w.id.toString(), name: w.name }))}
      defaultVehicleId={defaultVehicleId}
      driverName={session.name}
      lastEndMileage={lastLog?.endMileage ?? null}
    />
  );
}
