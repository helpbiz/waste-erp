import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { safetyWhere, isSafetyManager, type ChecklistItem } from '@/lib/safety';
import { todayKstDate } from '@/lib/dates';
import { fetchWeatherCached } from '@/lib/weather-providers';
import { hasFeature } from '@/lib/features';
import SafetyClient, { type Row } from './_safety-client';

export const dynamic = 'force-dynamic';

export type ContractorOpt = { id: string; name: string };

export default async function SafetyPage({
  searchParams,
}: {
  searchParams?: { tab?: string; contractorId?: string };
}) {
  const session = (await readSession())!;
  const today = todayKstDate();

  /* MUNI_ADMIN 업체 탭 필터 — 산하 업체 목록 + 선택된 업체로 범위 제한 */
  let contractorOpts: ContractorOpt[] = [];
  let pickedContractorId: bigint | null = null;
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), status: 'ACTIVE' },
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    contractorOpts = cs.map((c) => ({ id: c.id.toString(), name: c.companyName }));
    const raw = searchParams?.contractorId;
    if (raw && /^\d+$/.test(raw)) {
      const candidate = BigInt(raw);
      if (cs.find((c) => c.id === candidate)) pickedContractorId = candidate;
    }
  }

  /* 본인 서명 (일별 보고서 결재란용) */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    include: { activeSignature: { include: { asset: { select: { contentRef: true } } } } },
  });
  const meSignatureUrl = me?.activeSignature?.asset.contentRef ?? null;
  const isTbmManager = me?.isTbmManager ?? false;

  /* 실제 조회 범위 — 업체 선택 시 해당 업체만 */
  const baseWhere = pickedContractorId
    ? { contractorId: pickedContractorId }
    : safetyWhere(session);
  const scopedContractorId = pickedContractorId ?? (session.contractorId ? BigInt(session.contractorId) : null);

  const [items, todayWorkers, todayChecklist, tbm, workersList] = await Promise.all([
    prisma.safetyReport.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reporter: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    /* 오늘 점검 대상 근로자 (가시범위) */
    scopedContractorId
      ? prisma.user.count({
          where: { role: 'WORKER', status: 'ACTIVE', contractorId: scopedContractorId },
        })
      : Promise.resolve(0),
    scopedContractorId
      ? prisma.safetyReport.count({
          where: {
            contractorId: scopedContractorId,
            reportType: 'DAILY_CHECKLIST',
            reportDate: today,
          },
        })
      : Promise.resolve(0),
    scopedContractorId
      ? prisma.tbmSession.findFirst({
          where: { contractorId: scopedContractorId, facilityId: null, sessionDate: today },
          include: {
            signatures: { include: { worker: { select: { id: true, name: true, employeeNo: true } } } },
            creator: { select: { name: true } },
          },
        })
      : Promise.resolve(null),
    /* 알림톡 발송 대상 — 해당 업체 활성 워커 */
    scopedContractorId
      ? prisma.user.findMany({
          where: { contractorId: scopedContractorId, role: 'WORKER', status: 'ACTIVE' },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([] as { id: bigint; name: string }[]),
  ]);

  const rows: Row[] = items.map((r) => ({
    id: r.id.toString(),
    reportType: r.reportType,
    severity: r.severity,
    reportDate: r.reportDate.toISOString().slice(0, 10),
    occurredAt: r.occurredAt?.toISOString() ?? null,
    description: r.description,
    locationAddress: r.locationAddress,
    allChecked: r.allChecked,
    checklistItems: (r.checklistItems as ChecklistItem[] | null) ?? null,
    status: r.status,
    reviewNote: r.reviewNote,
    molDeadline: r.molDeadline?.toISOString() ?? null,
    molReportedAt: r.molReportedAt?.toISOString() ?? null,
    reportedAt: r.createdAt.toISOString(),
    reporter: r.reporter.name,
    reviewer: r.reviewer?.name ?? null,
  }));

  /* 거래처(위탁업체) 주소/좌표로 지역 날씨 적용 */
  const contractorInfo = scopedContractorId
    ? await prisma.contractor.findUnique({
        where: { id: scopedContractorId },
        select: { garageAddress: true, garageLat: true, garageLng: true },
      })
    : null;
  const weatherLocation = contractorInfo?.garageLat && contractorInfo?.garageLng
    ? {
        lat: Number(contractorInfo.garageLat),
        lng: Number(contractorInfo.garageLng),
        region: contractorInfo.garageAddress ?? undefined,
      }
    : contractorInfo?.garageAddress
    ? { region: contractorInfo.garageAddress }
    : undefined;

  const [hasNearMiss, hasIncident] = await Promise.all([
    scopedContractorId ? hasFeature(scopedContractorId, 'safetyNearMiss') : Promise.resolve(true),
    scopedContractorId ? hasFeature(scopedContractorId, 'safetyIncident') : Promise.resolve(true),
  ]);

  const defaultTab = searchParams?.tab === 'DAILY' ? 'DAILY' : 'ALL';

  return (
    <SafetyClient
      rows={rows}
      isManager={isSafetyManager(session.role) || isTbmManager}
      defaultTab={defaultTab as 'DAILY' | 'ALL'}
      contractorOpts={contractorOpts}
      selectedContractorId={pickedContractorId?.toString() ?? ''}
      todayWorkers={todayWorkers}
      todayChecklist={todayChecklist}
      weather={await fetchWeatherCached(weatherLocation)}
      tbm={tbm
        ? (() => {
            let contentText: string | null = tbm.content;
            let photoDataUrl: string | null = null;
            let leader: string | null = null;
            let location: string | null = null;
            let hazards: string | null = null;
            if (tbm.content) {
              try {
                const p = JSON.parse(tbm.content);
                if (p && typeof p === 'object') {
                  contentText = p.text ?? null;
                  photoDataUrl = p.photoDataUrl ?? null;
                  leader = p.leader ?? null;
                  location = p.location ?? null;
                  hazards = p.hazards ?? null;
                }
              } catch {}
            }
            return {
              id: tbm.id.toString(),
              topic: tbm.topic,
              content: contentText,
              photoDataUrl,
              leader,
              location,
              hazards,
              department: tbm.department ?? null,
              signCount: tbm.signatures.length,
              createdBy: tbm.creator.name,
              signedWorkers: tbm.signatures.map((s) => ({ id: s.worker.id.toString(), name: s.worker.name, employeeNo: s.worker.employeeNo })),
              unsignedWorkers: workersList
                .filter((w) => !tbm.signatures.find((s) => s.worker.id === w.id))
                .map((w) => ({ id: w.id.toString(), name: w.name, employeeNo: null })),
            };
          })()
        : null
      }
      alertWorkers={workersList.map((w) => ({ id: w.id.toString(), name: w.name }))}
      meName={me?.name ?? null}
      meSignatureUrl={meSignatureUrl}
      hasNearMiss={hasNearMiss}
      hasIncident={hasIncident}
    />
  );
}
