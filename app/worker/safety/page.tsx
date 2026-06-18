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

  const [todayChecklist, tbm, weather, me, facilities, userDetail] = await Promise.all([
    prisma.safetyReport.findFirst({
      where: { reportedBy: BigInt(session.userId), reportDate: today, reportType: 'DAILY_CHECKLIST' },
    }),
    !isAvac && contractorBigId
      ? prisma.tbmSession.findFirst({
          where: { contractorId: contractorBigId, facilityId: null, sessionDate: today },
          include: { signatures: true },
        })
      : Promise.resolve(null),
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

  const tbmSigned = !!tbm?.signatures.some((s) => s.workerId.toString() === session.userId);

  let tbmContentText: string | null = tbm?.content ?? null;
  let tbmPhotoDataUrl: string | null = null;
  let tbmLeader: string | null = null;
  let tbmLocation: string | null = null;
  let tbmHazards: string | null = null;
  let tbmPreWorkCheck: string | null = null;
  if (tbm?.content) {
    try {
      const p = JSON.parse(tbm.content);
      if (p && typeof p === 'object' && ('text' in p || 'photoDataUrl' in p)) {
        tbmContentText  = p.text         ?? null;
        tbmPhotoDataUrl = p.photoDataUrl ?? null;
        tbmLeader       = p.leader       ?? null;
        tbmLocation     = p.location     ?? null;
        tbmHazards      = p.hazards      ?? null;
        tbmPreWorkCheck = p.preWorkCheck ?? null;
      }
    } catch {}
  }

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
      tbm={tbm
        ? { id: tbm.id.toString(), topic: tbm.topic, content: tbmContentText, photoDataUrl: tbmPhotoDataUrl, leader: tbmLeader, location: tbmLocation, hazards: tbmHazards, preWorkCheck: tbmPreWorkCheck, signed: tbmSigned, signCount: tbm.signatures.length }
        : null
      }
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
