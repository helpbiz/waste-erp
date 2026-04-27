import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PerformanceClient from './_performance-client';

export const dynamic = 'force-dynamic';

export default async function PerformancePage() {
  const session = (await readSession())!;
  const contractorId = session.contractorId ? BigInt(session.contractorId) : null;

  /* 차량 목록 (반입실적 입력용) */
  const vehicles = contractorId
    ? await prisma.vehicle.findMany({
        where: { contractorId, status: 'ACTIVE' },
        select: { id: true, vehicleNo: true, vehicleType: true },
        orderBy: { vehicleNo: 'asc' },
      })
    : [];

  return (
    <PerformanceClient
      canEdit={session.role !== 'MUNI_ADMIN'}
      vehicles={vehicles.map((v) => ({ id: v.id.toString(), vehicleNo: v.vehicleNo, vehicleType: v.vehicleType }))}
    />
  );
}
