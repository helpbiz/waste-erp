import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { complaintWhere, isComplaintManager, isOverdue } from '@/lib/complaints';
import ComplaintsClient, { type Row, type Worker, type ContractorOpt } from './_complaints-client';

export const dynamic = 'force-dynamic';

export default async function ComplaintsPage() {
  const session = (await readSession())!;

  const rawItems = await prisma.complaint.findMany({
    where: complaintWhere(session),
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
    zoneName: c.zone?.zoneName ?? null,
    resolveNote: c.resolveNote,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
  }));

  /* 매니저는 담당자 dropdown 위해 worker 목록 prefetch */
  let workers: Worker[] = [];
  if (isComplaintManager(session.role)) {
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

  return (
    <ComplaintsClient
      role={session.role}
      userId={session.userId}
      items={items}
      workers={workers}
      contractorOpts={contractorOpts}
    />
  );
}
