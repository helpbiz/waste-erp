import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { leaveRemaining, recommendedAnnualLeaveDays } from '@/lib/users';
import LeaveClient from './_leave-client';

export const dynamic = 'force-dynamic';

export default async function WorkerLeavePage() {
  const session = (await readSession())!;
  const workerId = BigInt(session.userId);
  const year = new Date().getFullYear();

  const [me, balance, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: workerId }, select: { hireDate: true, name: true } }),
    prisma.annualLeaveBalance.findUnique({ where: { workerId_year: { workerId, year } } }),
    prisma.leaveRequest.findMany({
      where: { workerId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 30,
    }),
  ]);
  const recommend = recommendedAnnualLeaveDays(me?.hireDate ?? null);

  return (
    <LeaveClient
      year={year}
      hireDate={me?.hireDate?.toISOString().slice(0, 10) ?? null}
      recommend={recommend}
      balance={
        balance
          ? {
              granted: Number(balance.granted.toString()),
              used: Number(balance.used.toString()),
              carriedOver: Number(balance.carriedOver.toString()),
              remaining: leaveRemaining(balance),
              note: balance.note,
            }
          : null
      }
      requests={requests.map((r) => ({
        id: r.id.toString(),
        requestType: r.requestType,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }))}
      workerId={session.userId}
    />
  );
}
