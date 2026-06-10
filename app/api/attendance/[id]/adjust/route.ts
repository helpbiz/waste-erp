/**
 * POST /api/attendance/[id]/adjust
 * - 출퇴근 시각 / 근무유형 조정 (Plan §3-2 §6 P0)
 * - 권한: SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN (관리자만, 매니저)
 * - 사유 필수 (Plan §3-2 A "사유 입력 필수")
 * - 변경 전/후 원본 + 변경값을 attendance_adjustments에 SHA-256 체인으로 보존
 * - AttendanceRecord.status → ADJUSTED
 * - 월마감 잠금 후 수정은 Phase 1A-4 (소급수정 이중승인)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { computeHash } from '@/lib/audit-chain';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Body = z.object({
  adjustedCheckIn: z.string().datetime().nullable().optional(),
  adjustedCheckOut: z.string().datetime().nullable().optional(),
  adjustedWorkType: z
    .enum(['NORMAL', 'EARLY', 'EXTENDED', 'NIGHT', 'HOLIDAY', 'ON_DUTY'])
    .optional(),
  reason: z.string().trim().min(2).max(500),
  adjustmentType: z
    .enum(['CORRECTION', 'ADDITION', 'DELETION', 'LEAVE'])
    .default('CORRECTION'),
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
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  /* 가시범위 검증 + 월마감 차단 */
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

  /* 월마감 잠금 — Plan §6 P0 */
  const ymStr = record.workDate.toISOString().slice(0, 7); // 'YYYY-MM'
  const summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: { workerId_yearMonth: { workerId: record.workerId, yearMonth: ymStr } },
  });
  if (summary?.isFinalized) {
    return NextResponse.json(
      { error: 'month_finalized', message: '월 마감 후에는 소급수정 이중승인이 필요합니다 (Phase 1A-4).' },
      { status: 409 }
    );
  }

  /* 직전 체인 링크 조회 */
  const last = await prisma.attendanceAdjustment.findFirst({
    where: { recordId: id },
    orderBy: { id: 'desc' },
    select: { thisHash: true },
  });
  const prevHash = last?.thisHash ?? null;

  /* 조정 페이로드 (체인 입력) */
  const adjustedCheckIn = b.adjustedCheckIn === undefined ? record.checkInTime : b.adjustedCheckIn ? new Date(b.adjustedCheckIn) : null;
  const adjustedCheckOut = b.adjustedCheckOut === undefined ? record.checkOutTime : b.adjustedCheckOut ? new Date(b.adjustedCheckOut) : null;
  const adjustedWorkType = b.adjustedWorkType ?? record.workType;

  /* 출퇴근 시각 순서 검증: 퇴근이 출근보다 이를 수 없음 */
  if (adjustedCheckIn && adjustedCheckOut && adjustedCheckOut <= adjustedCheckIn) {
    return NextResponse.json(
      { error: 'invalid_time_range', message: '퇴근 시각이 출근 시각보다 이르거나 같습니다.' },
      { status: 400 }
    );
  }
  const now = new Date();

  const payload = {
    recordId: id.toString(),
    adjustedBy: session.userId,
    originalCheckIn: record.checkInTime?.toISOString() ?? null,
    originalCheckOut: record.checkOutTime?.toISOString() ?? null,
    originalWorkType: record.workType,
    adjustedCheckIn: adjustedCheckIn?.toISOString() ?? null,
    adjustedCheckOut: adjustedCheckOut?.toISOString() ?? null,
    adjustedWorkType,
    reason: b.reason,
    adjustmentType: b.adjustmentType,
    createdAt: now.toISOString(),
  };
  const thisHash = computeHash(prevHash, payload);

  /* 트랜잭션: 조정행 INSERT + 원본 레코드 UPDATE + audit_log INSERT */
  const result = await prisma.$transaction(async (tx) => {
    const adjustment = await tx.attendanceAdjustment.create({
      data: {
        recordId: id,
        adjustedBy: BigInt(session.userId),
        originalCheckIn: record.checkInTime,
        originalCheckOut: record.checkOutTime,
        originalWorkType: record.workType,
        adjustedCheckIn,
        adjustedCheckOut,
        adjustedWorkType,
        reason: b.reason,
        adjustmentType: b.adjustmentType,
        prevHash,
        thisHash,
        createdAt: now,
      },
    });

    const updated = await tx.attendanceRecord.update({
      where: { id },
      data: {
        checkInTime: adjustedCheckIn,
        checkOutTime: adjustedCheckOut,
        workType: adjustedWorkType,
        status: 'ADJUSTED',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'ATTENDANCE_ADJUST',
        resourceType: 'attendance_record',
        resourceId: id.toString(),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: {
          adjustmentId: adjustment.id.toString(),
          thisHash,
          prevHash,
          reasonLen: b.reason.length,
          adjustmentType: b.adjustmentType,
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
      workType: result.updated.workType,
      checkInTime: result.updated.checkInTime?.toISOString() ?? null,
      checkOutTime: result.updated.checkOutTime?.toISOString() ?? null,
    },
  });
}
