import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ComplaintClient from './_complaint-client';

export const dynamic = 'force-dynamic';

export default async function ComplaintPage() {
  const session = await readSession();

  /* 동료 근로자 목록 (태그 선택용) — 같은 위탁업체 WORKER */
  let coworkers: { id: string; name: string }[] = [];
  if (session?.contractorId) {
    /* userScope(WORKER)는 { id: -1 } 반환 → contractorId 직접 필터링 */
    const ws = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        status: 'ACTIVE',
        contractorId: BigInt(session.contractorId),
        NOT: { id: BigInt(session.userId) },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    coworkers = ws.map((w) => ({ id: w.id.toString(), name: w.name }));
  }

  return <ComplaintClient coworkers={coworkers} />;
}
