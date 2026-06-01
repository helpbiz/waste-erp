/**
 * POST /api/attendance/finalize-month/unlock
 * - 월마감 해제 — 관리자가 수정 후 재마감할 수 있도록 허용
 * - 권한: SUPER_ADMIN, CONTRACTOR_ADMIN, INTERNAL_ADMIN
 *   · CONTRACTOR_ADMIN/INTERNAL_ADMIN: 본인 회사 근로자만, workerIds 필수 (개별 해제)
 *   · SUPER_ADMIN: 전체 또는 선택 해제
 * - 사유 필수 (10자 이상) + Audit Log 자동 기록
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isAttendanceManager } from '@/lib/attendance-aggregate';

export const runtime = 'nodejs';

const Body = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  workerIds: z.array(z.union([z.string(), z.number()])).optional(),
  reason: z.string().trim().min(10).max(500),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  if (!isAttendanceManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { yearMonth, workerIds, reason } = parsed.data;

  /* CONTRACTOR_ADMIN/INTERNAL_ADMIN: 개별 근로자 지정 필수 + 본인 회사만 */
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  if (!isSuperAdmin && (!workerIds || workerIds.length === 0)) {
    return NextResponse.json(
      { error: 'workerIds_required', message: '관리자는 해제할 근로자를 반드시 지정해야 합니다.' },
      { status: 400 }
    );
  }

  /* 권한 범위 내 근로자만 해제 허용 */
  const where: { yearMonth: string; isFinalized: true; workerId?: { in: bigint[] } } = {
    yearMonth,
    isFinalized: true,
  };

  if (workerIds && workerIds.length > 0) {
    const requestedIds = workerIds.map((id) => BigInt(id));

    if (!isSuperAdmin && session.contractorId) {
      /* 본인 회사 소속 여부 검증 */
      const ownWorkers = await prisma.user.findMany({
        where: { id: { in: requestedIds }, contractorId: BigInt(session.contractorId) },
        select: { id: true },
      });
      const ownIds = ownWorkers.map((w) => w.id);
      if (ownIds.length === 0) {
        return NextResponse.json({ error: 'no_valid_workers', message: '본인 회사 소속 근로자만 해제 가능합니다.' }, { status: 400 });
      }
      where.workerId = { in: ownIds };
    } else {
      where.workerId = { in: requestedIds };
    }
  }

  const updated = await prisma.monthlyAttendanceSummary.updateMany({
    where,
    data: { isFinalized: false, finalizedAt: null, finalizedBy: null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'ATTENDANCE_MONTH_UNLOCK',
      resourceType: 'monthly_attendance_summary',
      resourceId: yearMonth,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { yearMonth, count: updated.count, reason } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    yearMonth,
    unlockedCount: updated.count,
  });
}
