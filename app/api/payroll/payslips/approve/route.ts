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
  const { count } = await prisma.payslipRecord.updateMany({
    where: { contractorId, yearMonth, approvedAt: null },
    data:  { approvedBy: BigInt(session.userId), approvedAt: now },
  });

  await prisma.auditLog.create({
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

  return NextResponse.json({ ok: true, approvedCount: count });
}
