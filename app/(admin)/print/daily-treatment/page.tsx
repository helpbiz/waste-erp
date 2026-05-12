import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import DailyTreatmentPrintClient from './_print-client';

export const dynamic = 'force-dynamic';

const MATERIAL_LABEL: Record<string, string> = {
  GENERAL: '생활', FOOD: '음식물', RECYCLING: '재활용', WOOD: '대형폐기물',
};

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export default async function DailyTreatmentPrintPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = (await readSession())!;
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
  const contractorId = session.contractorId ? BigInt(session.contractorId) : null;

  if (!contractorId) {
    return (
      <div className="p-8 text-center text-ink-muted font-bold">
        위탁업체 정보가 없습니다. CONTRACTOR_ADMIN 또는 INTERNAL_ADMIN 계정으로 접속하세요.
      </div>
    );
  }

  const [contractor, intakes] = await Promise.all([
    prisma.contractor.findUniqueOrThrow({
      where: { id: contractorId },
      select: {
        companyName: true,
        businessNo: true,
        municipality: { select: { name: true } },
      },
    }),
    prisma.recyclingCenterIntake.findMany({
      where: { contractorId, intakeDate: new Date(date + 'T00:00:00Z') },
      orderBy: [{ intakeTime: 'asc' }, { id: 'asc' }],
      include: {
        vehicle: { select: { vehicleNo: true } },
        facility: { select: { name: true } },
      },
    }),
  ]);

  const groups = new Map<string, number>();
  for (const cat of Object.keys(MATERIAL_LABEL)) groups.set(cat, 0);
  for (const i of intakes) {
    groups.set(i.materialCategory, (groups.get(i.materialCategory) ?? 0) + Number(i.weightTon));
  }
  const summary = Array.from(groups.entries()).map(([category, total]) => ({
    category,
    label: MATERIAL_LABEL[category] ?? category,
    totalTon: round3(total),
  }));

  const rows = intakes.map((i, idx) => ({
    no: idx + 1,
    vehiclePlate: i.vehicle?.vehicleNo ?? null,
    intakeTime: i.intakeTime,
    facilityName: i.facility?.name ?? null,
    materialCategory: i.materialCategory,
    weightTon: round3(Number(i.weightTon)),
    note: i.note ?? null,
  }));

  const totalWeight = round3(rows.reduce((s, r) => s + r.weightTon, 0));

  return (
    <DailyTreatmentPrintClient
      date={date}
      contractor={{
        companyName: contractor.companyName,
        businessNo: contractor.businessNo,
        municipalityName: contractor.municipality?.name ?? null,
      }}
      summary={summary}
      rows={rows}
      totalWeight={totalWeight}
      generatedBy={session.name ?? ''}
    />
  );
}
