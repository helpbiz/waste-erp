import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { todayKstDate } from '@/lib/dates';
import { DAILY_CHECKLIST_ITEMS } from '@/lib/safety';
import { fetchWeatherCached } from '@/lib/weather-providers';
import { isAvacContractor, getAvacFacilities, hasFeature } from '@/lib/features';
import { decryptField } from '@/lib/crypto';
import SafetyWorkerClient from './_safety-worker-client';
import type { FacilityOption } from './_safety-worker-client';

export const dynamic = 'force-dynamic';

export default async function SafetyWorkerPage() {
  const session = (await readSession())!;
  const today = todayKstDate();
  const contractorBigId = session.contractorId ? BigInt(session.contractorId) : null;

  const [isAvac, hasNearMiss, hasIncident] = await Promise.all([
    contractorBigId ? isAvacContractor(contractorBigId) : Promise.resolve(false),
    contractorBigId ? hasFeature(contractorBigId, 'safetyNearMiss') : Promise.resolve(true),
    contractorBigId ? hasFeature(contractorBigId, 'safetyIncident') : Promise.resolve(true),
  ]);

  const contractorInfo = contractorBigId
    ? await prisma.contractor.findUnique({
        where: { id: contractorBigId },
        select: { garageAddress: true, garageLat: true, garageLng: true },
      })
    : null;
  const weatherLocation = contractorInfo?.garageLat && contractorInfo?.garageLng
    ? { lat: Number(contractorInfo.garageLat), lng: Number(contractorInfo.garageLng), region: contractorInfo.garageAddress ?? undefined }
    : contractorInfo?.garageAddress
    ? { region: contractorInfo.garageAddress }
    : undefined;

  const [todayChecklist, tbmList, weather, me, facilities, userDetail] = await Promise.all([
    prisma.safetyReport.findFirst({
      where: { reportedBy: BigInt(session.userId), reportDate: today, reportType: 'DAILY_CHECKLIST' },
    }),
    !isAvac && contractorBigId
      ? prisma.tbmSession.findMany({
          where: { contractorId: contractorBigId, facilityId: null, sessionDate: today },
          include: {
            signatures: true,
            schedule: { select: { label: true, sortOrder: true } },
            audience: { select: { workerId: true } },
          },
        })
      : Promise.resolve([]),
    fetchWeatherCached(weatherLocation),
    prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { emergencyContact: true, emergencyPhone: true },
    }),
    isAvac && contractorBigId
      ? getAvacFacilities(contractorBigId)
      : Promise.resolve([] as { id: bigint; name: string; type: string }[]),
    prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: {
        isFacilityOperator: true, primaryFacilityId: true,
        primaryFacility: { select: { id: true, name: true } },
        isTbmManager: true, name: true,
        department: { select: { head: { select: { name: true } } } },
      },
    }),
  ]);

  /* 서명대상 프리셋이 있으면 그 대상만, 없으면 전체 대상(기존 동작) — 스케줄 순서로 정렬 */
  const visibleTbmList = tbmList
    .filter((t) => t.audience.length === 0 || t.audience.some((a) => a.workerId.toString() === session.userId))
    .sort((a, b) => (a.schedule?.sortOrder ?? -1) - (b.schedule?.sortOrder ?? -1));

  const tbmSessions = visibleTbmList.map((t) => {
    let contentText: string | null = t.content ?? null;
    let photoDataUrl: string | null = null;
    let leader: string | null = null;
    let location: string | null = null;
    let hazards: string | null = null;
    let preWorkCheck: string | null = null;
    if (t.content) {
      try {
        const p = JSON.parse(t.content);
        if (p && typeof p === 'object' && ('text' in p || 'photoDataUrl' in p)) {
          contentText  = p.text         ?? null;
          photoDataUrl = p.photoDataUrl ?? null;
          leader       = p.leader       ?? null;
          location     = p.location     ?? null;
          hazards      = p.hazards      ?? null;
          preWorkCheck = p.preWorkCheck ?? null;
        }
      } catch {}
    }
    return {
      id: t.id.toString(),
      topic: t.topic,
      content: contentText,
      photoDataUrl,
      leader,
      location,
      hazards,
      preWorkCheck,
      signed: t.signatures.some((s) => s.workerId.toString() === session.userId),
      signCount: t.signatures.length,
      scheduleId: t.scheduleId?.toString() ?? null,
      scheduleLabel: t.schedule?.label ?? null,
    };
  });

  const [guardianName, guardianPhone] = await Promise.all([
    decryptField(me?.emergencyContact ?? null).catch(() => null),
    decryptField(me?.emergencyPhone ?? null).catch(() => null),
  ]);

  return (
    <SafetyWorkerClient
      checklistDef={[...DAILY_CHECKLIST_ITEMS]}
      submitted={!!todayChecklist}
      submittedAt={todayChecklist?.createdAt.toISOString() ?? null}
      allChecked={todayChecklist?.allChecked ?? false}
      tbmSessions={tbmSessions}
      weather={weather}
      guardian={{ name: guardianName, phone: guardianPhone }}
      isAvac={isAvac}
      facilities={facilities.map((f): FacilityOption => ({ id: f.id.toString(), name: f.name }))}
      isFacilityOperator={userDetail?.isFacilityOperator ?? false}
      isTbmManager={userDetail?.isTbmManager ?? false}
      defaultTbmLeader={userDetail?.department?.head?.name ?? userDetail?.name ?? ''}
      operatorFacility={userDetail?.primaryFacility
        ? { id: userDetail.primaryFacility.id.toString(), name: userDetail.primaryFacility.name }
        : null}
      hasNearMiss={hasNearMiss}
      hasIncident={hasIncident}
    />
  );
}
