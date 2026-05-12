import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { safetyWhere, isSafetyManager, type ChecklistItem } from '@/lib/safety';
import { todayKstDate } from '@/lib/dates';
import { fetchWeatherCached } from '@/lib/weather-providers';
import SafetyClient, { type Row } from './_safety-client';

export const dynamic = 'force-dynamic';

export default async function SafetyPage() {
  const session = (await readSession())!;
  const today = todayKstDate();

  /* 본인 서명 (일별 보고서 결재란용) */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    include: { activeSignature: { include: { asset: { select: { contentRef: true } } } } },
  });
  const meSignatureUrl = me?.activeSignature?.asset.contentRef ?? null;

  const [items, todayWorkers, todayChecklist, tbm, workersList] = await Promise.all([
    prisma.safetyReport.findMany({
      where: safetyWhere(session),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reporter: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    /* 오늘 점검 대상 근로자 (가시범위) */
    session.contractorId
      ? prisma.user.count({
          where: { role: 'WORKER', status: 'ACTIVE', contractorId: BigInt(session.contractorId) },
        })
      : Promise.resolve(0),
    session.contractorId
      ? prisma.safetyReport.count({
          where: {
            contractorId: BigInt(session.contractorId),
            reportType: 'DAILY_CHECKLIST',
            reportDate: today,
          },
        })
      : Promise.resolve(0),
    session.contractorId
      ? prisma.tbmSession.findFirst({
          where: { contractorId: BigInt(session.contractorId), facilityId: null, sessionDate: today },
          include: {
            signatures: { include: { worker: { select: { id: true, name: true, employeeNo: true } } } },
            creator: { select: { name: true } },
          },
        })
      : Promise.resolve(null),
    /* 알림톡 발송 대상 — 본인 위탁업체 활성 워커 */
    session.contractorId
      ? prisma.user.findMany({
          where: { contractorId: BigInt(session.contractorId), role: 'WORKER', status: 'ACTIVE' },
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
  const contractorInfo = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: BigInt(session.contractorId) },
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

  return (
    <SafetyClient
      rows={rows}
      isManager={isSafetyManager(session.role)}
      todayWorkers={todayWorkers}
      todayChecklist={todayChecklist}
      weather={await fetchWeatherCached(weatherLocation)}
      tbm={tbm
        ? (() => {
            let contentText: string | null = tbm.content;
            let photoDataUrl: string | null = null;
            if (tbm.content) {
              try {
                const p = JSON.parse(tbm.content);
                if (p && typeof p === 'object' && ('text' in p || 'photoDataUrl' in p)) {
                  contentText = p.text ?? null;
                  photoDataUrl = p.photoDataUrl ?? null;
                }
              } catch {}
            }
            return {
              id: tbm.id.toString(),
              topic: tbm.topic,
              content: contentText,
              photoDataUrl,
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
    />
  );
}
