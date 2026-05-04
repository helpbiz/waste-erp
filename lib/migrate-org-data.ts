// Design Ref: §10 — 기존 User.positionId(전역) + User.rank(String) → 업체별 매핑
import { prisma } from './db';

export async function migrateOrgData() {
  let positionsMapped = 0;
  let ranksMapped = 0;
  let skipped = 0;

  // 1. User.positionId(전역 Position) → ContractorPosition
  const usersWithPosition = await prisma.user.findMany({
    where: { positionId: { not: null } },
    include: { position: true },
  });

  for (const u of usersWithPosition) {
    if (!u.position || !u.contractorId) { skipped++; continue; }
    const category = u.position.category === 'OFFICE' ? 'ADMIN' : (u.position.category ?? 'FIELD');
    const cp = await prisma.contractorPosition.upsert({
      where: { contractorId_name: { contractorId: u.contractorId, name: u.position.label } },
      update: {},
      create: {
        contractorId: u.contractorId,
        name: u.position.label,
        category: ['MANAGER', 'FIELD', 'ADMIN'].includes(category) ? category : 'FIELD',
        sortOrder: u.position.sortOrder,
      },
    });
    await prisma.user.update({ where: { id: u.id }, data: { contractorPositionId: cp.id } });
    positionsMapped++;
  }

  // 2. User.rank(String enum) → ContractorRank
  const usersWithRank = await prisma.user.findMany({
    where: { rank: { not: null }, contractorId: { not: null } },
  });

  for (const u of usersWithRank) {
    if (!u.rank || !u.contractorId) continue;
    const cr = await prisma.contractorRank.upsert({
      where: { contractorId_name: { contractorId: u.contractorId, name: u.rank } },
      update: {},
      create: { contractorId: u.contractorId, name: u.rank, level: 99 },
    });
    await prisma.user.update({ where: { id: u.id }, data: { rankId: cr.id } });
    ranksMapped++;
  }

  return { positionsMapped, ranksMapped, skipped };
}
