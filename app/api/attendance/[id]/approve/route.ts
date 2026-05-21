/**
 * POST /api/attendance/[id]/approve
 * - PENDING 근태 레코드 승인 → status: APPROVED
 * - 권한: SUPER_ADMIN, CONTRACTOR_ADMIN(COMPANY), INTERNAL_ADMIN(MANAGER)
 * - 사유는 선택 (승인은 통상 무사유). audit_log 에 영구 기록.
 * - 월마감 잠금 후 차단.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Body = z.object({
  reason: z.string().trim().max(500).optional(),
});

function isAttendanceManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAttendanceManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const reason = parsed.data.reason ?? null;

  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    select: { id: true, contractorId: true, status: true, workerId: true, workDate: true },
  });
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (
    session.role !== 'SUPER_ADMIN' &&
    session.contractorId &&
    record.contractorId.toString() !== session.contractorId
  ) {
    return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
  }

  if (record.status === 'APPROVED') {
    return NextResponse.json({ error: 'already_approved' }, { status: 409 });
  }

  /* 월마감 잠금 */
  const ymStr = record.workDate.toISOString().slice(0, 7);
  const summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: { workerId_yearMonth: { workerId: record.workerId, yearMonth: ymStr } },
  });
  if (summary?.isFinalized) {
    return NextResponse.json(
      { error: 'month_finalized', message: '월 마감 후에는 소급수정 이중승인이 필요합니다 (Phase 1A-4).' },
      { status: 409 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.attendanceRecord.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    await tx.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'ATTENDANCE_APPROVE',
        resourceType: 'attendance_record',
        resourceId: id.toString(),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: {
          previousStatus: record.status,
          reason,
        } as Prisma.InputJsonValue,
      },
    });
    return u;
  });

  return NextResponse.json({
    ok: true,
    record: { id: updated.id.toString(), status: updated.status },
  });
}
