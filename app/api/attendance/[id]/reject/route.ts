/**
 * POST /api/attendance/[id]/reject
 * - 근태 레코드 반려 — 출퇴근 데이터 그대로 두고 status → REJECTED.
 * - 권한: SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN (조정과 동일).
 * - 사유 필수, attendance_adjustments(adjustmentType='DELETION') + audit_log 에 SHA-256 체인 기록.
 * - 월마감 잠금 후 반려는 차단 (소급수정 이중승인 — Phase 1A-4).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { computeHash } from '@/lib/audit-chain';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Body = z.object({
  reason: z.string().trim().min(2).max(500),
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

  const id = BigInt(params.id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: { worker: { select: { id: true, name: true, contractorId: true } } },
  });
  if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* CONTRACTOR/INTERNAL은 본인 위탁업체만 */
  if (
    session.role !== 'SUPER_ADMIN' &&
    session.contractorId &&
    record.contractorId.toString() !== session.contractorId
  ) {
    return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
  }

  if (record.status === 'REJECTED') {
    return NextResponse.json({ error: 'already_rejected' }, { status: 409 });
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

  /* 직전 체인 링크 */
  const last = await prisma.attendanceAdjustment.findFirst({
    where: { recordId: id },
    orderBy: { id: 'desc' },
    select: { thisHash: true },
  });
  const prevHash = last?.thisHash ?? null;

  const now = new Date();
  const payload = {
    recordId: id.toString(),
    adjustedBy: session.userId,
    originalCheckIn: record.checkInTime?.toISOString() ?? null,
    originalCheckOut: record.checkOutTime?.toISOString() ?? null,
    originalWorkType: record.workType,
    /* reject: 데이터 변경 없음, status 만 변경 */
    rejected: true,
    reason: b.reason,
    adjustmentType: 'DELETION',
    createdAt: now.toISOString(),
  };
  const thisHash = computeHash(prevHash, payload);

  const result = await prisma.$transaction(async (tx) => {
    const adjustment = await tx.attendanceAdjustment.create({
      data: {
        recordId: id,
        adjustedBy: BigInt(session.userId),
        originalCheckIn: record.checkInTime,
        originalCheckOut: record.checkOutTime,
        originalWorkType: record.workType,
        /* 반려는 값 변경 없음 → adjusted* 필드는 원본 유지 (감사 가독성) */
        adjustedCheckIn: record.checkInTime,
        adjustedCheckOut: record.checkOutTime,
        adjustedWorkType: record.workType,
        reason: b.reason,
        adjustmentType: 'DELETION',
        prevHash,
        thisHash,
        createdAt: now,
      },
    });

    const updated = await tx.attendanceRecord.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await tx.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'ATTENDANCE_REJECT',
        resourceType: 'attendance_record',
        resourceId: id.toString(),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: {
          adjustmentId: adjustment.id.toString(),
          thisHash,
          prevHash,
          reasonLen: b.reason.length,
        } as Prisma.InputJsonValue,
      },
    });

    return { adjustment, updated };
  });

  return NextResponse.json({
    ok: true,
    adjustment: {
      id: result.adjustment.id.toString(),
      recordId: id.toString(),
      thisHash: result.adjustment.thisHash,
      prevHash: result.adjustment.prevHash,
      createdAt: result.adjustment.createdAt.toISOString(),
    },
    record: {
      id: result.updated.id.toString(),
      status: result.updated.status,
    },
  });
}
