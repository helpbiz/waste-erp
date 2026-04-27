/**
 * GET /api/health/records — 본인 위탁업체 근로자 건강기록 목록
 *  - 권한: CONTRACTOR_ADMIN, INTERNAL_ADMIN, SUPER_ADMIN (의료 정보, 매니저만)
 *  - MUNI_ADMIN/WORKER 차단
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { decryptHealthRecord } from '@/lib/health';

export const runtime = 'nodejs';

function isHealthManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isHealthManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const contractorId = BigInt(session.contractorId);

  const workers = await prisma.user.findMany({
    where: { role: 'WORKER', status: 'ACTIVE', contractorId },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      healthRecord: true,
    },
    orderBy: { name: 'asc' },
  });

  /* 조회 audit_log (의료 정보 접근 추적 — 개인정보보호법 §28) */
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'HEALTH_RECORD_LIST_VIEW',
      resourceType: 'health_record',
      resourceId: contractorId.toString(),
      metadata: { workerCount: workers.length } as object,
    },
  });

  const decryptedWorkers = await Promise.all(
    workers.map(async (w) => {
      const dec = await decryptHealthRecord(w.healthRecord);
      return {
        workerId: w.id.toString(),
        workerName: w.name,
        employeeNo: w.employeeNo,
        hasRecord: !!w.healthRecord,
        record: dec
          ? {
              id: w.healthRecord!.id.toString(),
              ...dec,
              updatedAt: w.healthRecord!.updatedAt.toISOString(),
            }
          : null,
      };
    })
  );
  return NextResponse.json({ workers: decryptedWorkers });
}
