import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import { DAILY_CHECKLIST_ITEMS } from '@/lib/safety';
import { fetchWeatherCached } from '@/lib/weather-providers';
import SafetyWorkerClient from './_safety-worker-client';

export const dynamic = 'force-dynamic';

export default async function SafetyWorkerPage() {
  const session = (await readSession())!;
  const today = todayKstDate();

  const [todayChecklist, tbm, weather, me] = await Promise.all([
    prisma.safetyReport.findFirst({
      where: {
        reportedBy: BigInt(session.userId),
        reportDate: today,
        reportType: 'DAILY_CHECKLIST',
      },
    }),
    session.contractorId
      ? prisma.tbmSession.findUnique({
          where: {
            contractorId_sessionDate: { contractorId: BigInt(session.contractorId), sessionDate: today },
          },
          include: { signatures: true },
        })
      : Promise.resolve(null),
    fetchWeatherCached(),
    prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { emergencyContact: true, emergencyPhone: true },
    }),
  ]);

  const tbmSigned = !!tbm?.signatures.some((s) => s.workerId.toString() === session.userId);

  return (
    <SafetyWorkerClient
      checklistDef={[...DAILY_CHECKLIST_ITEMS]}
      submitted={!!todayChecklist}
      submittedAt={todayChecklist?.createdAt.toISOString() ?? null}
      allChecked={todayChecklist?.allChecked ?? false}
      tbm={tbm
        ? { id: tbm.id.toString(), topic: tbm.topic, content: tbm.content, signed: tbmSigned, signCount: tbm.signatures.length }
        : null
      }
      weather={weather}
      guardian={{
        name: me?.emergencyContact ?? null,
        phone: me?.emergencyPhone ?? null,
      }}
    />
  );
}
