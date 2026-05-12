import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager } from '@/lib/vehicle-logs';
import { prisma } from '@/lib/db';
import ImportClient from './_import-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '일괄 업로드 · 공비랩' };

export default async function ImportPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!isVehicleLogManager(session.role)) redirect('/dashboard');

  const contractors =
    session.role === 'SUPER_ADMIN'
      ? await prisma.contractor.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { companyName: 'asc' },
          select: { id: true, companyName: true },
        })
      : [];

  return (
    <ImportClient
      isSuperAdmin={session.role === 'SUPER_ADMIN'}
      contractors={contractors.map((c) => ({
        id: c.id.toString(),
        name: c.companyName,
      }))}
    />
  );
}
