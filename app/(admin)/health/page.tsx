import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptHealthRecord } from '@/lib/health';
import HealthClient, { type Row } from './_health-client';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const session = (await readSession())!;
  /* 의료 정보 — CONTRACTOR_ADMIN/INTERNAL_ADMIN/SUPER만, MUNI/WORKER 차단 */
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'CONTRACTOR_ADMIN' && session.role !== 'INTERNAL_ADMIN') {
    redirect('/dashboard');
  }
  if (!session.contractorId && session.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const contractorId = session.contractorId ? BigInt(session.contractorId) : undefined;
  const workers = await prisma.user.findMany({
    where: { role: 'WORKER', status: 'ACTIVE', ...(contractorId ? { contractorId } : {}) },
    select: { id: true, name: true, employeeNo: true, healthRecord: true },
    orderBy: { name: 'asc' },
  });

  /* 조회 audit_log */
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'HEALTH_RECORD_PAGE_VIEW',
      resourceType: 'health_record',
      resourceId: contractorId?.toString() ?? 'all',
      metadata: { workerCount: workers.length } as object,
    },
  });

  const rows: Row[] = await Promise.all(
    workers.map(async (w) => ({
      workerId: w.id.toString(),
      workerName: w.name,
      employeeNo: w.employeeNo,
      record: await decryptHealthRecord(w.healthRecord),
    }))
  );

  return <HealthClient rows={rows} />;
}
