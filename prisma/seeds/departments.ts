/**
 * Department 시드 — 사용자 요청 2026-04-29 4부서 재정의 (idempotent).
 * 관리부 / 수집운반부 / 민원고객지원부 / 행정지원부.
 *
 * 실행: npx tsx prisma/seeds/departments.ts
 *
 * 특정 contractor에 대해 시드. 환경변수 SEED_CONTRACTOR_ID로 override 가능.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: '관리부',         sortOrder: 10 },
  { name: '수집운반부',     sortOrder: 20 },
  { name: '민원고객지원부', sortOrder: 30 },
  { name: '행정지원부',     sortOrder: 40 },
];

/* 기존 8부서 — 시드된 적이 있는 contractor 에 대해 deactivate (active=false). */
const LEGACY_DEPT_NAMES = [
  '임원', '안전환경관리팀', '수집운반팀', '장비관리팀',
  '환경미화팀', '재활용 선별팀', '민원고객지원팀', '행정회계팀',
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
    let upserted = 0, deactivated = 0;
    /* 1) 신규 4부서 upsert */
    for (const d of DEPARTMENTS) {
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
    /* 2) Legacy 8부서 deactivate (없으면 skip) */
    for (const name of LEGACY_DEPT_NAMES) {
      const existing = await prisma.department.findFirst({
        where: { contractorId: c.id, parentId: null, name },
      });
      if (existing && existing.active) {
        await prisma.department.update({ where: { id: existing.id }, data: { active: false } });
        deactivated++;
      }
    }
    console.log(`✓ ${c.companyName} (id=${c.id}) — ${upserted}개 활성 / ${deactivated}개 legacy 비활성`);
  }

  const total = await prisma.department.count({ where: { active: true } });
  console.log(`✓ 활성 부서 합계: ${total}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
