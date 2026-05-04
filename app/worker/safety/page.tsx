import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import { DAILY_CHECKLIST_ITEMS } from '@/lib/safety';
import { fetchWeatherCached } from '@/lib/weather-providers';
import { isAvacContractor, getAvacFacilities } from '@/lib/features';
import SafetyWorkerClient from './_safety-worker-client';

export const dynamic = 'force-dynamic';

export default async function SafetyWorkerPage() {
  const session = (await readSession())!;
  const today = todayKstDate();
  const contractorBigId = session.contractorId ? BigInt(session.contractorId) : null;

  const isAvac = contractorBigId ? await isAvacContractor(contractorBigId) : false;

  const [todayChecklist, tbm, weather, me, facilities] = await Promise.all([
    prisma.safetyReport.findFirst({
      where: { reportedBy: BigInt(session.userId), reportDate: today, reportType: 'DAILY_CHECKLIST' },
    }),
    // AVAC: 시설별 TBM은 클라이언트에서 선택 후 동적 로드. 비-AVAC만 서버에서 로드.
    !isAvac && contractorBigId
      ? prisma.tbmSession.findFirst({
          where: { contractorId: contractorBigId, facilityId: null, sessionDate: today },
          include: { signatures: true },
        })
      : Promise.resolve(null),
    fetchWeatherCached(),
    prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { emergencyContact: true, emergencyPhone: true },
    }),
    isAvac && contractorBigId
      ? getAvacFacilities(contractorBigId)
      : Promise.resolve([] as { id: bigint; name: string; type: string }[]),
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
      guardian={{ name: me?.emergencyContact ?? null, phone: me?.emergencyPhone ?? null }}
      isAvac={isAvac}
      facilities={facilities.map((f) => ({ id: f.id.toString(), name: f.name }))}
    />
  );
}
