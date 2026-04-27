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

  /* 본인 위탁업체 차량 목록 (반입실적 입력용) */
  const vehicles = await prisma.vehicle.findMany({
    where: { contractorId: BigInt(session.contractorId), status: 'ACTIVE' },
    select: { id: true, vehicleNo: true, vehicleType: true },
    orderBy: { vehicleNo: 'asc' },
  });

  return (
    <PerformanceClient
      vehicles={vehicles.map((v) => ({
        id: v.id.toString(),
        vehicleNo: v.vehicleNo,
        vehicleType: v.vehicleType,
      }))}
    />
  );
}
