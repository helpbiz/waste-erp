/**
 * Department 시드 — 표준 8개 부서 (idempotent)
 *
 * 실행: npx tsx prisma/seeds/departments.ts
 *
 * 특정 contractor에 대해 시드. 환경변수 SEED_CONTRACTOR_ID로 override 가능.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: '임원',          sortOrder: 10 },
  { name: '안전환경관리팀', sortOrder: 20 },
  { name: '수집운반팀',     sortOrder: 30 },
  { name: '장비관리팀',     sortOrder: 40 },
  { name: '환경미화팀',     sortOrder: 50 },
  { name: '재활용 선별팀',  sortOrder: 60 },
  { name: '민원고객지원팀', sortOrder: 70 },
  { name: '행정회계팀',     sortOrder: 80 },
];

async function main() {
  /* 대상 contractor 결정 */
  const targetId = process.env.SEED_CONTRACTOR_ID ? BigInt(process.env.SEED_CONTRACTOR_ID) : null;
  const contractors = targetId
    ? await prisma.contractor.findMany({ where: { id: targetId } })
    : await prisma.contractor.findMany({ where: { status: 'ACTIVE' } });

  if (contractors.length === 0) {
    console.log('대상 contractor 없음.');
    process.exit(1);
  }

  for (const c of contractors) {
    let upserted = 0;
    for (const d of DEPARTMENTS) {
      /* parentId NULL 컴파운드 unique 회피 — findFirst + create/update */
      const existing = await prisma.department.findFirst({
        where: { contractorId: c.id, parentId: null, name: d.name },
      });
      if (existing) {
        await prisma.department.update({
          where: { id: existing.id },
          data: { sortOrder: d.sortOrder, active: true },
        });
      } else {
        await prisma.department.create({
          data: { contractorId: c.id, parentId: null, name: d.name, sortOrder: d.sortOrder, active: true },
        });
      }
      upserted++;
    }
    console.log(`✓ ${c.companyName} (id=${c.id}) — ${upserted}개 부서 시드`);
  }

  const total = await prisma.department.count({ where: { active: true } });
  console.log(`✓ 활성 부서 합계: ${total}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
