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

  const [vehicles, departments, opsHistory] = await Promise.all([
    prisma.vehicle.findMany({
      where: { contractorId: BigInt(session.contractorId), status: 'ACTIVE' },
      select: { id: true, vehicleNo: true, vehicleType: true, departmentId: true, driver: { select: { departmentId: true } } },
      orderBy: { vehicleNo: 'asc' },
    }),
    prisma.department.findMany({
      where: { contractorId: BigInt(session.contractorId), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
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
        /* 차량에 직접 등록된 부서 우선, 없으면 운전자 소속 부서로 폴백(기존 배정 유지) */
        departmentId: (v.departmentId ?? v.driver?.departmentId)?.toString() ?? null,
      }))}
      departments={departments.map((d) => ({ id: d.id.toString(), name: d.name }))}
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
