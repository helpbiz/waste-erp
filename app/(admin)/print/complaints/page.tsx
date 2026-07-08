import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { complaintWhere } from '@/lib/complaints';
import { ComplaintStatus } from '@prisma/client';
import ComplaintsPrintClient from './_print-client';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수', ASSIGNED: '배정', IN_PROGRESS: '처리중',
  COMPLETED: '완료', REJECTED: '반려',
};

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음',
  BULKY_WASTE: '대형폐기물', OTHER: '기타',
};

export default async function ComplaintsPrintPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string };
}) {
  const session = (await readSession())!;

  const from = searchParams.from ? new Date(searchParams.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = searchParams.to ? new Date(searchParams.to + 'T23:59:59') : new Date();
  const statusFilter = searchParams.status ?? '';

  const rows = await prisma.complaint.findMany({
    where: {
      ...complaintWhere(session),
      reportedAt: { gte: from, lte: to },
      ...(statusFilter ? { status: statusFilter as ComplaintStatus } : {}),
    },
    include: {
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
      zone: { select: { zoneName: true } },
    },
    orderBy: { reportedAt: 'asc' },
  });

  /* requestImage/completionImage는 단일 data URL 또는 JSON 배열 문자열 두 가지 형식 */
  function parseImages(raw: string | null): string[] {
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try { return JSON.parse(raw) as string[]; } catch { return []; }
    }
    return [raw];
  }

  const items = rows.map((c, idx) => ({
    no: idx + 1,
    id: c.id.toString(),
    type: TYPE_LABEL[c.type] ?? c.type,
    status: STATUS_LABEL[c.status] ?? c.status,
    description: c.description ?? '',
    locationAddress: c.locationAddress ?? '',
    reportedAt: c.reportedAt.toISOString(),
    dueDate: c.dueDate?.toISOString() ?? null,
    reporter: c.reporter?.name ?? c.citizenName ?? '시민',
    assignee: c.assignee?.name ?? null,
    zoneName: c.zone?.zoneName ?? null,
    resolveNote: c.resolveNote ?? null,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    complainantPhone: c.complainantPhone ?? null,
    photosBefore: parseImages(c.requestImage),
    photosAfter: parseImages(c.completionImage),
  }));

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return (
    <ComplaintsPrintClient
      items={items}
      from={fromStr}
      to={toStr}
      statusFilter={statusFilter}
    />
  );
}
