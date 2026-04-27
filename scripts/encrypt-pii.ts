/**
 * 일회성 마이그레이션 — User.address/bankAccount AES-256 암호화
 * 멱등(idempotent): 이미 'v1:' prefix가 붙어 있으면 스킵.
 *
 * 실행: npx tsx scripts/encrypt-pii.ts
 */
import { PrismaClient } from '@prisma/client';
import { encryptField } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, address: true, bankAccount: true },
  });
  let updated = 0;
  for (const u of users) {
    const data: { address?: string | null; bankAccount?: string | null } = {};
    if (u.address && !u.address.startsWith('v1:')) {
      data.address = await encryptField(u.address);
    }
    if (u.bankAccount && !u.bankAccount.startsWith('v1:')) {
      data.bankAccount = await encryptField(u.bankAccount);
    }
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: u.id }, data });
      updated++;
    }
  }
  console.log(`✓ PII 마이그레이션 완료 — ${updated}건 암호화 (전체 ${users.length}명)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
