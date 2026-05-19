import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { complaintWhere, isComplaintManager, isOverdue } from '@/lib/complaints';
import ComplaintsClient, { type Row, type Worker, type ContractorOpt, type ZoneOpt } from './_complaints-client';

export const dynamic = 'force-dynamic';

export default async function ComplaintsPage() {
  const session = (await readSession())!;

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const rawItems = await prisma.complaint.findMany({
    where: complaintWhere(session, workerIsManager),
    orderBy: { reportedAt: 'desc' },
    include: {
      reporter: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      zone: { select: { zoneName: true } },
    },
  });

  const items: Row[] = rawItems.map((c) => ({
    id: c.id.toString(),
    type: c.type,
    status: c.status,
    description: c.description,
    locationAddress: c.locationAddress,
    locationLat: c.locationLat ? Number(c.locationLat) : null,
    locationLng: c.locationLng ? Number(c.locationLng) : null,
    reportedAt: c.reportedAt.toISOString(),
    dueDate: c.dueDate?.toISOString() ?? null,
    overdue: isOverdue({ dueDate: c.dueDate, status: c.status }),
    reporter: c.reporter
      ? { id: c.reporter.id.toString(), name: c.reporter.name }
      : { id: '0', name: c.citizenName ?? '시민' },
    assignee: c.assignee ? { id: c.assignee.id.toString(), name: c.assignee.name } : null,
    zoneId: c.zoneId?.toString() ?? null,
    zoneName: c.zone?.zoneName ?? null,
    resolveNote: c.resolveNote,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    complainantPhone: c.complainantPhone ?? null,
    requestImage: c.requestImage ?? null,
  }));

  /* 매니저(역할 또는 플래그)는 담당자 dropdown 위해 worker 목록 prefetch */
  let workers: Worker[] = [];
  if (isComplaintManager(session.role) || workerIsManager) {
    const ws = await prisma.user.findMany({
      where: {
        role: 'WORKER',
        status: 'ACTIVE',
        contractorId: session.contractorId ? BigInt(session.contractorId) : undefined,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    workers = ws.map((w) => ({ id: w.id.toString(), name: w.name }));
  }

  /* 입력 시 contractor 선택용 — MUNI/SUPER만 필요, 그 외는 자동 */
  let contractorOpts: ContractorOpt[] = [];
  if (session.role === 'SUPER_ADMIN') {
    const cs = await prisma.contractor.findMany({
      select: { id: true, companyName: true, municipality: { select: { name: true } } },
      orderBy: { companyName: 'asc' },
    });
    contractorOpts = cs.map((c) => ({ id: c.id.toString(), name: `${c.companyName} (${c.municipality.name})` }));
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), status: 'ACTIVE' },
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
    });
    contractorOpts = cs.map((c) => ({ id: c.id.toString(), name: c.companyName }));
  }

  /* MUNI_ADMIN 구역 필터용 — 산하 위탁업체의 담당구역 목록 */
  let zoneOpts: ZoneOpt[] = [];
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const zones = await prisma.cleaningZone.findMany({
      where: { contractor: { municipalityId: BigInt(session.municipalityId) } },
      select: { id: true, zoneName: true, zoneCode: true },
      orderBy: { zoneName: 'asc' },
    });
    zoneOpts = zones.map((z) => ({ id: z.id.toString(), name: `${z.zoneName} (${z.zoneCode})` }));
  }

  return (
    <ComplaintsClient
      role={workerIsManager ? 'CONTRACTOR_ADMIN' : session.role}
      userId={session.userId}
      items={items}
      workers={workers}
      contractorOpts={contractorOpts}
      zoneOpts={zoneOpts}
    />
  );
}
