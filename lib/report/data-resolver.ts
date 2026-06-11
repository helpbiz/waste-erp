// Design Ref: §2.1 lib/report/data-resolver — spec 기반 Prisma 쿼리
// Plan SC: facilityId NULL 안전 처리, intakeTime asc 정렬, 합계 집계

import { prisma } from '@/lib/db';
import type { ReportSpec, ReportData, ReportContext } from './spec-types';

const MATERIAL_LABELS: Record<string, string> = {
  GENERAL: '생활',
  FOOD: '음식물',
  RECYCLING: '재활용',
  WOOD: '대형폐기물',
};

export async function resolveReportData(
  spec: ReportSpec,
  ctx: ReportContext,
): Promise<ReportData> {
  if (spec.table.source !== 'RecyclingCenterIntake') {
    throw new Error(`unsupported_source:${spec.table.source}`);
  }

  const contractorIdBig = BigInt(ctx.contractorId);

  const [contractor, intakes] = await Promise.all([
    prisma.contractor.findUniqueOrThrow({
      where: { id: contractorIdBig },
      select: {
        id: true,
        companyName: true,
        businessNo: true,
        municipality: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.recyclingCenterIntake.findMany({
      where: {
        contractorId: contractorIdBig,
        intakeDate: new Date(ctx.date + 'T00:00:00Z'),
      },
      orderBy: [{ intakeTime: 'asc' }, { id: 'asc' }],
      include: {
        vehicle: { select: { vehicleNo: true } },
        facility: { select: { name: true } },
        disposalSite: { select: { name: true } },
      },
    }),
  ]);

  /* summary — materialCategory 기준 합계 (4성상 기본 노출, 0도 표시) */
  const labelsFromSpec = spec.summary?.labels ?? MATERIAL_LABELS;
  const groups = new Map<string, number>();
  for (const cat of Object.keys(labelsFromSpec)) groups.set(cat, 0);
  for (const i of intakes) {
    const w = Number(i.weightTon);
    groups.set(i.materialCategory, (groups.get(i.materialCategory) ?? 0) + w);
  }
  const summary = Array.from(groups.entries()).map(([category, total]) => ({
    category,
    label: labelsFromSpec[category] ?? category,
    totalTon: round3(total),
  }));

  const rows = intakes.map((i, idx) => ({
    no: idx + 1,
    vehiclePlate: i.vehicle?.vehicleNo ?? null,
    intakeTime: i.intakeTime,
    facilityName: i.facility?.name ?? null,
    disposalSiteName: i.disposalSite?.name ?? null,
    materialCategory: i.materialCategory,
    weightTon: round3(Number(i.weightTon)),
    note: i.note,
  }));

  const totalWeight = round3(rows.reduce((s, r) => s + r.weightTon, 0));

  return {
    header: {
      contractor: {
        id: contractor.id.toString(),
        companyName: contractor.companyName,
        businessNo: contractor.businessNo,
        logoUrl: null, // TODO: Contractor.logoUrl 컬럼 추가 후 매핑
      },
      municipality: contractor.municipality
        ? {
            id: contractor.municipality.id.toString(),
            name: contractor.municipality.name,
            code: contractor.municipality.code,
          }
        : null,
      date: ctx.date,
    },
    summary,
    rows,
    totals: { weightTon: totalWeight },
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: ctx.user.id, name: ctx.user.name },
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
