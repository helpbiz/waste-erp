import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PerformanceClient from './_performance-client';

export const dynamic = 'force-dynamic';

export default async function WorkerPerformancePage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard');
  if (!session.contractorId) redirect('/worker');

  const userDetail = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { isFacilityOperator: true, primaryFacilityId: true, primaryFacility: { select: { id: true, name: true } } },
  });

  const [vehicles, opsHistory] = await Promise.all([
    prisma.vehicle.findMany({
      where: { contractorId: BigInt(session.contractorId), status: 'ACTIVE' },
      select: { id: true, vehicleNo: true, vehicleType: true },
      orderBy: { vehicleNo: 'asc' },
    }),
    userDetail?.isFacilityOperator && userDetail.primaryFacilityId
      ? prisma.facilityDailyOps.findMany({
          where: { facilityId: userDetail.primaryFacilityId },
          orderBy: { opsDate: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  return (
    <PerformanceClient
      vehicles={vehicles.map((v) => ({
        id: v.id.toString(),
        vehicleNo: v.vehicleNo,
        vehicleType: v.vehicleType,
      }))}
      isFacilityOperator={userDetail?.isFacilityOperator ?? false}
      primaryFacility={
        userDetail?.primaryFacility
          ? { id: userDetail.primaryFacility.id.toString(), name: userDetail.primaryFacility.name }
          : null
      }
      opsHistory={opsHistory.map((r) => ({
        id: r.id.toString(),
        opsDate: r.opsDate.toISOString().slice(0, 10),
        generalOpHours: Number(r.generalOpHours),
        foodOpHours: Number(r.foodOpHours),
        downtimeHours: Number(r.downtimeHours),
        downtimeReason: r.downtimeReason ?? null,
        generalWasteTon: Number(r.generalWasteTon),
        foodWasteTon: Number(r.foodWasteTon),
        generalCollectTon: Number(r.generalCollectTon),
        foodCollectTon: Number(r.foodCollectTon),
        generalTransferTon: Number(r.generalTransferTon),
        foodTransferTon: Number(r.foodTransferTon),
        prevDayPowerKwh: Number(r.prevDayPowerKwh),
        notes: r.notes ?? null,
      }))}
    />
  );
}
