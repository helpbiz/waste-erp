/**
 * 관리자 — 작업자 익명 건의함 목록 + 통계.
 *
 * GET /api/admin/suggestions
 *   role: SUPER_ADMIN / MUNI_ADMIN(읽기) / CONTRACTOR_ADMIN / INTERNAL_ADMIN
 *   scope:
 *     SUPER_ADMIN  → 전체
 *     MUNI_ADMIN   → 본인 지자체 산하 회사들
 *     CONTRACTOR_ADMIN/INTERNAL_ADMIN → 본인 회사
 *   query: ?stats=1 → 통계만 반환 (목록 생략)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { buildSmallGroupMasks } from '@/lib/suggestions';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ADMIN_ROLES.has(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* scope 결정 */
  let contractorIdFilter: bigint[] | null = null;
  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ items: [], stats: emptyStats() });
    contractorIdFilter = [BigInt(session.contractorId)];
  } else if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ items: [], stats: emptyStats() });
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), deletedAt: null },
      select: { id: true },
    });
    contractorIdFilter = cs.map((c) => c.id);
    if (contractorIdFilter.length === 0) return NextResponse.json({ items: [], stats: emptyStats() });
  }

  const where = contractorIdFilter ? { contractorId: { in: contractorIdFilter } } : {};

  const url = new URL(req.url);
  const statsOnly = url.searchParams.get('stats') === '1';

  const [rows, allForStats] = await Promise.all([
    statsOnly
      ? Promise.resolve([] as Awaited<ReturnType<typeof fetchList>>)
      : fetchList(where),
    prisma.workerSuggestion.findMany({
      where,
      select: {
        category: true,
        satisfactionScore: true,
        departmentId: true,
        positionCode: true,
        contractorId: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);

  /* 통계 — 카테고리/부서별 평균. 단, 부서는 회사별 마스킹 필요 */
  const categoryAgg = new Map<string, { sum: number; count: number }>();
  const deptAgg = new Map<string, { contractorId: string; departmentId: string; sum: number; count: number }>();
  const statusAgg: Record<string, number> = { NEW: 0, REVIEWING: 0, ANSWERED: 0, ARCHIVED: 0 };

  for (const r of allForStats) {
    const ca = categoryAgg.get(r.category) ?? { sum: 0, count: 0 };
    ca.sum += r.satisfactionScore;
    ca.count += 1;
    categoryAgg.set(r.category, ca);

    if (r.departmentId) {
      const k = `${r.contractorId.toString()}::${r.departmentId.toString()}`;
      const da = deptAgg.get(k) ?? {
        contractorId: r.contractorId.toString(),
        departmentId: r.departmentId.toString(),
        sum: 0,
        count: 0,
      };
      da.sum += r.satisfactionScore;
      da.count += 1;
      deptAgg.set(k, da);
    }

    statusAgg[r.status] = (statusAgg[r.status] ?? 0) + 1;
  }

  /* 부서 마스킹 — 회사 단위로 buildSmallGroupMasks 적용 */
  const distinctContractorIds = Array.from(new Set(allForStats.map((r) => r.contractorId.toString()))).map((s) => BigInt(s));
  const masksByContractor = new Map<string, Awaited<ReturnType<typeof buildSmallGroupMasks>>>();
  await Promise.all(
    distinctContractorIds.map(async (cId) => {
      masksByContractor.set(cId.toString(), await buildSmallGroupMasks(cId));
    }),
  );

  const deptIds = Array.from(deptAgg.values()).map((d) => BigInt(d.departmentId));
  const depts = deptIds.length
    ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptNameMap = new Map(depts.map((d) => [d.id.toString(), d.name]));

  const stats = {
    total: allForStats.length,
    avgSatisfaction: allForStats.length
      ? Math.round((allForStats.reduce((s, x) => s + x.satisfactionScore, 0) / allForStats.length) * 10) / 10
      : null,
    byStatus: statusAgg,
    byCategory: Array.from(categoryAgg.entries()).map(([cat, v]) => ({
      category: cat,
      count: v.count,
      avgSatisfaction: Math.round((v.sum / v.count) * 10) / 10,
    })),
    byDepartment: Array.from(deptAgg.values())
      .map((d) => {
        const masks = masksByContractor.get(d.contractorId);
        const masked = masks ? masks.smallDepartmentIds.has(d.departmentId) : true;
        return {
          contractorId: d.contractorId,
          departmentId: d.departmentId,
          departmentName: masked ? null : deptNameMap.get(d.departmentId) ?? null,
          masked,
          count: d.count,
          avgSatisfaction: Math.round((d.sum / d.count) * 10) / 10,
        };
      })
      .sort((a, b) => a.avgSatisfaction - b.avgSatisfaction), // 만족도 낮은 부서 먼저
  };

  if (statsOnly) return NextResponse.json({ stats, items: [] });

  return NextResponse.json({
    items: rows.map((r) => {
      const masks = masksByContractor.get(r.contractorId.toString());
      const deptMasked = r.departmentId
        ? !!masks?.smallDepartmentIds.has(r.departmentId.toString())
        : true;
      const posMasked = r.positionCode ? !!masks?.smallPositionCodes.has(r.positionCode) : true;
      return {
        id: r.id.toString(),
        contractorId: r.contractorId.toString(),
        category: r.category,
        satisfactionScore: r.satisfactionScore,
        content: r.content,
        photos: (r.photos as string[] | null) ?? [],
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        departmentName: deptMasked ? null : r.department?.name ?? null,
        positionCode: posMasked ? null : r.positionCode,
        replies: r.replies.map((rep) => ({
          id: rep.id.toString(),
          content: rep.content,
          createdAt: rep.createdAt.toISOString(),
          replierName: rep.replier.name,
          replierRole: rep.replier.role,
        })),
      };
    }),
    stats,
  });
}

function fetchList(where: { contractorId?: { in: bigint[] } }) {
  return prisma.workerSuggestion.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: {
      department: { select: { name: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { replier: { select: { name: true, role: true } } },
      },
    },
  });
}

function emptyStats() {
  return {
    total: 0,
    avgSatisfaction: null,
    byStatus: { NEW: 0, REVIEWING: 0, ANSWERED: 0, ARCHIVED: 0 },
    byCategory: [],
    byDepartment: [],
  };
}
