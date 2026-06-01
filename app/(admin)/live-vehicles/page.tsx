import { readSession } from '@/lib/auth';
import { requireFeature } from '@/lib/feature-guard';
import { prisma } from '@/lib/db';
import LiveVehiclesClient from './_live-vehicles-client';

export const dynamic = 'force-dynamic';

export default async function LiveVehiclesPage() {
  const session = (await readSession())!;
  await requireFeature(session, 'vehicleTracking');

  /* MUNI_ADMIN 산하 업체 목록 */
  const muniContractorOpts = session.role === 'MUNI_ADMIN' && session.municipalityId
    ? (await prisma.contractor.findMany({
        where: { municipalityId: BigInt(session.municipalityId), status: 'ACTIVE' },
        select: { id: true, companyName: true },
        orderBy: { companyName: 'asc' },
      })).map((c) => ({ id: c.id.toString(), name: c.companyName }))
    : [];

  return (
    <LiveVehiclesClient
      canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'}
      isSuperAdmin={session.role === 'SUPER_ADMIN'}
      muniContractorOpts={muniContractorOpts}
    />
  );
}
