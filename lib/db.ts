import { PrismaClient } from '@prisma/client';

/* BigInt JSON 직렬화 폴리필 — Next.js Route Handler 응답에 안전 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace, no-var
  var __wciPrisma: PrismaClient | undefined;
  interface BigInt { toJSON(): string }
}
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}

export const prisma =
  globalThis.__wciPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalThis.__wciPrisma = prisma;
