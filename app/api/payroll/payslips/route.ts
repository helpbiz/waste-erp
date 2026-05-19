/**
 * GET /api/payroll/payslips
 *   admin: ?yearMonth=2026-05  → 해당 월 전체 레코드 (발송 전 포함)
 *   worker: ?yearMonth=2026-05 → 본인 발송된 명세서만
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url     = new URL(req.url);
  const ym      = url.searchParams.get('yearMonth') ?? '';
  const isManagerRole = canManageUsers(session.role);
  let isPayrollManagerWorker = false;
  if (!isManagerRole && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isPayrollManager: true } });
    isPayrollManagerWorker = flag?.isPayrollManager === true;
  }
  const isAdmin = isManagerRole || isPayrollManagerWorker;

  /* admin은 yearMonth 필수, worker는 전체 조회 */
  if (isAdmin && !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) {
    return NextResponse.json({ error: 'invalid_yearMonth' }, { status: 400 });
  }

  if (isAdmin) {
    const contractorId = session.contractorId ? BigInt(session.contractorId)
      : (url.searchParams.get('contractorId') ? BigInt(url.searchParams.get('contractorId')!) : null);
    if (!contractorId) return NextResponse.json({ error: 'contractor_required' }, { status: 400 });

    const records = await prisma.payslipRecord.findMany({
      where:   { contractorId, yearMonth: ym },
      include: { worker: { select: { id: true, name: true, employeeNo: true } } },
      orderBy: { worker: { name: 'asc' } },
    });

    return NextResponse.json({
      items: records.map((r) => ({
        id:          r.id.toString(),
        workerId:    r.workerId.toString(),
        workerName:  r.worker.name,
        employeeNo:  r.worker.employeeNo,
        yearMonth:   r.yearMonth,
        data:        r.data,
        isPublished: r.isPublished,
        publishedAt: r.publishedAt?.toISOString() ?? null,
      })),
    });
  }

  /* WORKER — 본인 발송분만 */
  const records = await prisma.payslipRecord.findMany({
    where:   { workerId: BigInt(session.userId), isPublished: true },
    orderBy: { yearMonth: 'desc' },
    take:    24,
  });

  return NextResponse.json({
    items: records.map((r) => ({
      id:          r.id.toString(),
      yearMonth:   r.yearMonth,
      data:        r.data,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    })),
  });
}
