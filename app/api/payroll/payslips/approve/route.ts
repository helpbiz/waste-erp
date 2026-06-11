/**
 * POST /api/payroll/payslips/approve
 * body: { yearMonth }
 * 결재승인권자로 지정된 사용자만 호출 가능.
 * 해당 월 전체 PayslipRecord에 approvedBy/approvedAt 세팅.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

const Body = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  /* P0-1: CONTRACTOR_ADMIN 또는 SUPER_ADMIN만 급여 승인 가능 */
  if (session.role !== 'CONTRACTOR_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { yearMonth } = parsed.data;

  /* 현재 사용자의 업체 확인 */
  const contractorId = session.contractorId ? BigInt(session.contractorId) : null;
  if (!contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  /* 해당 업체 정책에서 승인권자 확인 */
  const policy = await prisma.payrollPolicy.findUnique({
    where: { contractorId },
    select: { payslipApproverId: true },
  });

  if (!policy?.payslipApproverId) {
    return NextResponse.json({ error: 'no_approver_configured' }, { status: 403 });
  }

  if (policy.payslipApproverId.toString() !== session.userId) {
    return NextResponse.json({ error: 'not_approver' }, { status: 403 });
  }

  const now = new Date();
  /* P2-3: updateMany + auditLog를 단일 트랜잭션으로 묶어 로그 누락 방지 */
  const approvedCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payslipRecord.updateMany({
      where: { contractorId, yearMonth, approvedAt: null },
      data:  { approvedBy: BigInt(session.userId), approvedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId:      BigInt(session.userId),
        actorRole:    session.role,
        action:       'PAYSLIP_APPROVE',
        resourceType: 'payslip_record',
        resourceId:   contractorId.toString(),
        contractorId,
        metadata:     { yearMonth, approvedCount: count } as object,
      },
    });
    return count;
  });

  return NextResponse.json({ ok: true, approvedCount });
}
