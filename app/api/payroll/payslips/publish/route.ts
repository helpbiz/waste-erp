/**
 * POST /api/payroll/payslips/publish
 * body: { yearMonth, contractorId? }
 * isPublished=false 인 레코드를 일괄 발송 처리 (isPublished=true, publishedAt=now)
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

const Body = z.object({
  yearMonth:    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  contractorId: z.union([z.string(), z.number()]).optional(),
  /* 특정 ID만 발송하는 경우 (선택) */
  ids:          z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const isManagerRole = canManageUsers(session.role);
  let workerIsPayrollManager = false;
  if (!isManagerRole && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isPayrollManager: true } });
    workerIsPayrollManager = flag?.isPayrollManager === true;
  }
  if (!isManagerRole && !workerIsPayrollManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { yearMonth, contractorId: rawCid, ids } = parsed.data;

  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN') {
    if (!rawCid) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    contractorId = BigInt(rawCid);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  /* 승인 필요 여부 체크 */
  const policy = await prisma.payrollPolicy.findUnique({
    where: { contractorId },
    select: { payslipApproverId: true },
  });
  if (policy?.payslipApproverId) {
    const unapproved = await prisma.payslipRecord.count({
      where: ids?.length
        ? { id: { in: ids.map((i) => BigInt(i)) }, contractorId, yearMonth, approvedAt: null }
        : { contractorId, yearMonth, isPublished: false, approvedAt: null },
    });
    if (unapproved > 0) {
      return NextResponse.json(
        { error: 'approval_required', unapprovedCount: unapproved },
        { status: 403 }
      );
    }
  }

  const now = new Date();
  const where = ids?.length
    ? { id: { in: ids.map((i) => BigInt(i)) }, contractorId, yearMonth }
    : { contractorId, yearMonth, isPublished: false };

  /* P2-3: updateMany + auditLog를 단일 트랜잭션으로 묶어 로그 누락 방지 */
  const publishedCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payslipRecord.updateMany({
      where,
      data: { isPublished: true, publishedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId: BigInt(session.userId), actorRole: session.role,
        action: 'PAYSLIP_PUBLISH', resourceType: 'payslip_record',
        resourceId: contractorId.toString(),
        contractorId,
        metadata: { yearMonth, publishedCount: count } as object,
      },
    });
    return count;
  });

  return NextResponse.json({ ok: true, publishedCount });
}
