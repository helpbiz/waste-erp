/**
 * GET /api/attendance/[id]/history
 * - 근태 조정 이력 + SHA-256 체인 무결성 검증 (노동청 감사 대비)
 * - 권한: 매니저 또는 본인 (WORKER) 본인 레코드만
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { verifyChain, type ChainLink } from '@/lib/audit-chain';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    select: { id: true, contractorId: true, workerId: true },
  });
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* 가시범위 */
  const isManager =
    session.role === 'SUPER_ADMIN' ||
    session.role === 'CONTRACTOR_ADMIN' ||
    session.role === 'INTERNAL_ADMIN';
  const sameContractor = session.contractorId === record.contractorId.toString();
  const isOwner = session.role === 'WORKER' && record.workerId.toString() === session.userId;

  if (
    !(session.role === 'SUPER_ADMIN' || (isManager && sameContractor) || isOwner)
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const adjustments = await prisma.attendanceAdjustment.findMany({
    where: { recordId: id },
    orderBy: { id: 'asc' },
    include: {
      record: { select: { workerId: true } },
    },
  });

  /* 체인 검증 — 저장된 payload와 동일한 형태로 재구성 */
  const links: ChainLink[] = adjustments.map((a) => ({
    id: a.id,
    prevHash: a.prevHash,
    thisHash: a.thisHash,
    payload: {
      recordId: a.recordId.toString(),
      adjustedBy: a.adjustedBy.toString(),
      originalCheckIn: a.originalCheckIn?.toISOString() ?? null,
      originalCheckOut: a.originalCheckOut?.toISOString() ?? null,
      originalWorkType: a.originalWorkType,
      adjustedCheckIn: a.adjustedCheckIn?.toISOString() ?? null,
      adjustedCheckOut: a.adjustedCheckOut?.toISOString() ?? null,
      adjustedWorkType: a.adjustedWorkType,
      reason: a.reason,
      adjustmentType: a.adjustmentType,
      createdAt: a.createdAt.toISOString(),
    },
  }));
  const verify = verifyChain(links);

  return NextResponse.json({
    recordId: id.toString(),
    chain: {
      length: links.length,
      verified: verify.valid,
      brokenAt: verify.valid ? null : verify.brokenAt,
      reason: verify.valid ? null : verify.reason,
    },
    adjustments: adjustments.map((a) => ({
      id: a.id.toString(),
      adjustedBy: a.adjustedBy.toString(),
      adjustmentType: a.adjustmentType,
      reason: a.reason,
      original: {
        checkIn: a.originalCheckIn?.toISOString() ?? null,
        checkOut: a.originalCheckOut?.toISOString() ?? null,
        workType: a.originalWorkType,
      },
      adjusted: {
        checkIn: a.adjustedCheckIn?.toISOString() ?? null,
        checkOut: a.adjustedCheckOut?.toISOString() ?? null,
        workType: a.adjustedWorkType,
      },
      prevHash: a.prevHash,
      thisHash: a.thisHash,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
