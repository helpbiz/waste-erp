/**
 * Position 마스터 시드 — Design §2.4 (12종)
 * 멱등(idempotent): code 기준 upsert.
 *
 * 실행: npx tsx prisma/seeds/positions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POSITIONS = [
  /* OFFICE 라인 */
  { code: 'CEO',          label: '대표',     category: 'OFFICE', sortOrder: 10 },
  { code: 'EXEC',         label: '임원',     category: 'OFFICE', sortOrder: 20 },
  { code: 'DIRECTOR',     label: '본부장',   category: 'OFFICE', sortOrder: 30 },
  { code: 'HEAD',         label: '실장',     category: 'OFFICE', sortOrder: 40 },
  { code: 'TEAM_LEAD',    label: '팀장',     category: 'OFFICE', sortOrder: 50 },
  { code: 'STAFF',        label: '사원',     category: 'OFFICE', sortOrder: 60 },
  /* FIELD 라인 */
  { code: 'DRIVER',       label: '운전원',   category: 'FIELD',  sortOrder: 110 },
  { code: 'COLLECTOR',    label: '수거원',   category: 'FIELD',  sortOrder: 120 },
  { code: 'RAPID',        label: '기동반',   category: 'FIELD',  sortOrder: 130 },
  { code: 'STREET_CLEAN', label: '가로청소', category: 'FIELD',  sortOrder: 140 },
  { code: 'ALLEY_CLEAN',  label: '골목청소', category: 'FIELD',  sortOrder: 150 },
  /* OTHER */
  { code: 'OTHER',        label: '기타',     category: 'OTHER',  sortOrder: 999 },
];

async function main() {
  for (const p of POSITIONS) {
    await prisma.position.upsert({
      where: { code: p.code },
      create: p,
      update: { label: p.label, category: p.category, sortOrder: p.sortOrder },
    });
  }
  const count = await prisma.position.count();
  console.log(`✓ Position 시드 완료 — 총 ${count}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
