/**
 * ApprovalPolicy 기본 시드 — leave_request 2단계
 *  stage 1: TEAM_LEAD, HEAD, DIRECTOR, EXEC, CEO
 *  stage 2: CEO
 *
 * 실행: npx tsx prisma/seeds/approval-policies.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POLICIES = [
  { resourceType: 'leave_request', stage: 1, positionCodes: 'TEAM_LEAD,HEAD,DIRECTOR,EXEC,CEO' },
  { resourceType: 'leave_request', stage: 2, positionCodes: 'CEO' },
];

async function main() {
  const contractors = await prisma.contractor.findMany({ where: { status: 'ACTIVE' } });
  for (const c of contractors) {
    for (const p of POLICIES) {
      await prisma.approvalPolicy.updateMany({
        where: { contractorId: c.id, resourceType: p.resourceType, stage: p.stage, active: true },
        data: { active: false },
      });
      await prisma.approvalPolicy.create({
        data: { contractorId: c.id, ...p },
      });
    }
    console.log(`✓ ${c.companyName} — ${POLICIES.length}개 정책 시드`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
