/**
 * Position 마스터 시드 — 사용자 요청 2026-04-29 7종 재정의 (idempotent).
 * 임원 / 관리자 / 운전원 / 수거원 / 미화원 / 간접인력 / 관리직.
 *
 * HR 5카드 매핑 (인사현황 통합 운영 보고서):
 *  - 운전원   = DRIVER
 *  - 수거원   = COLLECTOR + CLEANER (미화원 포함 — 사용자 요청)
 *  - 현장지원 = INDIRECT (간접인력)
 *  - 관리직   = EXECUTIVE + MANAGER + ADMIN_STAFF (OFFICE 카테고리 전체)
 *
 * 실행: npx tsx prisma/seeds/positions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POSITIONS = [
  /* OFFICE 라인 — HR card 의 '관리직' */
  { code: 'EXECUTIVE',   label: '임원',     category: 'OFFICE', sortOrder: 10 },
  { code: 'MANAGER',     label: '관리자',   category: 'OFFICE', sortOrder: 20 },
  { code: 'ADMIN_STAFF', label: '관리직',   category: 'OFFICE', sortOrder: 30 },
  /* FIELD 라인 — HR card 의 '운전원'/'수거원' */
  { code: 'DRIVER',      label: '운전원',   category: 'FIELD',  sortOrder: 110 },
  { code: 'COLLECTOR',   label: '수거원',   category: 'FIELD',  sortOrder: 120 },
  { code: 'CLEANER',     label: '미화원',   category: 'FIELD',  sortOrder: 130 }, /* HR 통계 시 수거원으로 합산 */
  /* OTHER 라인 — HR card 의 '현장지원' */
  { code: 'INDIRECT',    label: '간접인력', category: 'OTHER',  sortOrder: 200 },
];

/* 이전 코드(2026-04-28 이전) — active=false 처리하여 dropdown 에서 제거.
   기존 user.positionId 참조는 유지하므로 데이터 무결성 보존. */
const LEGACY_CODES = [
  'CEO', 'EXEC', 'DIRECTOR', 'HEAD', 'TEAM_LEAD', 'STAFF',
  'RAPID', 'STREET_CLEAN', 'ALLEY_CLEAN', 'OTHER',
];

async function main() {
  /* 1) 신규 7종 upsert */
  for (const p of POSITIONS) {
    await prisma.position.upsert({
      where: { code: p.code },
      create: { ...p, active: true },
      update: { label: p.label, category: p.category, sortOrder: p.sortOrder, active: true },
    });
  }

  /* 2) Legacy 코드 deactivate (존재할 때만) */
  for (const code of LEGACY_CODES) {
    const existing = await prisma.position.findUnique({ where: { code } });
    if (existing) {
      await prisma.position.update({ where: { code }, data: { active: false } });
    }
  }

  const activeCount = await prisma.position.count({ where: { active: true } });
  const inactiveCount = await prisma.position.count({ where: { active: false } });
  console.log(`✓ Position 시드 — 활성 ${activeCount}건 / 비활성(legacy) ${inactiveCount}건`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
