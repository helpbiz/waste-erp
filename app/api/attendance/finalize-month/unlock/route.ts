/**
 * POST /api/attendance/finalize-month/unlock
 * - 월마감 해제 (소급수정 진입) — Phase 1A-4 이중승인 stub
 * - 권한: SUPER_ADMIN만 (Phase 1A-4에서 approver1+approver2 다른 인물 CHECK)
 * - 사유 필수 + audit_log 기록 + summary.isFinalized → false
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  workerIds: z.array(z.union([z.string(), z.number()])).optional(),
  reason: z.string().trim().min(10).max(500),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'forbidden', message: '월마감 해제는 SUPER_ADMIN 또는 이중승인 워크플로 (Phase 1A-4) 필요' },
      { status: 403 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { yearMonth, workerIds, reason } = parsed.data;

  const where: { yearMonth: string; isFinalized: true; workerId?: { in: bigint[] } } = {
    yearMonth,
    isFinalized: true,
  };
  if (workerIds && workerIds.length > 0) {
    where.workerId = { in: workerIds.map((id) => BigInt(id)) };
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
      metadata: { yearMonth, count: updated.count, reasonLen: reason.length } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    yearMonth,
    unlockedCount: updated.count,
  });
}
