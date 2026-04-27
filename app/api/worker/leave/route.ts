/**
 * GET /api/worker/leave — 본인 잔여·신청 내역 (WORKER 전용)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { leaveRemaining, recommendedAnnualLeaveDays } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerId = BigInt(session.userId);
  const year = new Date().getFullYear();

  const [me, balance, requests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: workerId },
      select: { hireDate: true },
    }),
    prisma.annualLeaveBalance.findUnique({
      where: { workerId_year: { workerId, year } },
    }),
    prisma.leaveRequest.findMany({
      where: { workerId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 30,
    }),
  ]);

  const recommend = recommendedAnnualLeaveDays(me?.hireDate ?? null);

  return NextResponse.json({
    year,
    balance: balance
      ? {
          granted: Number(balance.granted.toString()),
          used: Number(balance.used.toString()),
          carriedOver: Number(balance.carriedOver.toString()),
          remaining: leaveRemaining(balance),
          note: balance.note,
        }
      : null,
    recommend,
    requests: requests.map((r) => ({
      id: r.id.toString(),
      requestType: r.requestType,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
