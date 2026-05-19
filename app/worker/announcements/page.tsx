import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import WorkerAnnouncementsClient from './_announcements-worker-client';

export const dynamic = 'force-dynamic';

export default async function WorkerAnnouncementsPage() {
  const session = (await readSession())!;

  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { isNoticeManager: true },
  });

  return <WorkerAnnouncementsClient isNoticeManager={me?.isNoticeManager ?? false} />;
}
