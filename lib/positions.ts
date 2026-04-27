/**
 * Position 마스터 read-through 캐시
 * Design Ref: §2.1 D1, NFR-03
 */
import { prisma } from './db';

type PositionRow = { id: bigint; code: string; label: string; category: string; sortOrder: number; active: boolean };

let cache: PositionRow[] | null = null;
let cacheLoadedAt = 0;
const TTL_MS = 60 * 60 * 1000; // 1h

export async function listActivePositions(): Promise<PositionRow[]> {
  if (cache && Date.now() - cacheLoadedAt < TTL_MS) return cache;
  const rows = await prisma.position.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  cache = rows;
  cacheLoadedAt = Date.now();
  return rows;
}

export async function findPositionByCode(code: string): Promise<PositionRow | null> {
  const list = await listActivePositions();
  return list.find((p) => p.code === code) ?? null;
}

export function invalidatePositionCache() { cache = null; }

export const POSITION_CATEGORY_LABEL: Record<string, string> = {
  OFFICE: '사무',
  FIELD: '현장',
  OTHER: '기타',
};

export const POSITION_CATEGORY_COLOR: Record<string, string> = {
  OFFICE: 'bg-blue-100 text-blue-700 border-blue-300',
  FIELD: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  OTHER: 'bg-slate-100 text-slate-600 border-slate-300',
};
