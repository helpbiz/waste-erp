import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import WeatherNoticesWorkerClient from './_worker-client';

export const dynamic = 'force-dynamic';

export default async function WorkerWeatherNoticesPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!session.contractorId) redirect('/worker');

  const today = todayKstDate();
  const contractorId = BigInt(session.contractorId);

  /* 오늘 공지 목록 + 내 사진 업로드 여부 */
  const notices = await prisma.weatherSafetyNotice.findMany({
    where: {
      contractorId,
      noticeDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 3600 * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      photos: {
        where: { workerId: BigInt(session.userId) },
        select: { id: true, photoData: true, uploadedAt: true },
      },
    },
  });

  const items = notices.map((n) => ({
    id: n.id.toString(),
    alertType: n.alertType,
    title: n.title,
    content: n.content,
    noticeDate: n.noticeDate.toISOString().slice(0, 10),
    myPhoto: n.photos[0]
      ? { id: n.photos[0].id.toString(), uploadedAt: n.photos[0].uploadedAt.toISOString() }
      : null,
  }));

  return <WeatherNoticesWorkerClient items={items} todayStr={today.toISOString().slice(0, 10)} />;
}
