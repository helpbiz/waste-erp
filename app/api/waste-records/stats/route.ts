/**
 * GET /api/waste-records/stats?from=&to=&groupBy=daily|monthly|material
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function contractorScope(session: { role: string; contractorId: string | null; municipalityId: string | null }) {
  if (session.role === 'SUPER_ADMIN') return {} as Prisma.WasteTreatmentRecordWhereInput;
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') ?? new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);

  const where: Prisma.WasteTreatmentRecordWhereInput = {
    ...contractorScope(session),
    recordDate: { gte: new Date(from), lte: new Date(to) },
  };

  const items = await prisma.wasteTreatmentRecord.findMany({
    where,
    orderBy: { recordDate: 'asc' },
  });

  /* daily */
  const dailyMap = new Map<string, number>();
  /* monthly */
  const monthlyMap = new Map<string, number>();
  /* material */
  const materialMap = new Map<string, number>();
  let total = 0;

  for (const r of items) {
    const d = r.recordDate.toISOString().slice(0, 10);
    const ym = d.slice(0, 7);
    const w = Number(r.weightTon.toString());
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + w);
    monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + w);
    materialMap.set(r.materialCode, (materialMap.get(r.materialCode) ?? 0) + w);
    total += w;
  }

  return NextResponse.json({
    range: { from, to },
    total: Math.round(total * 1000) / 1000,
    daily: Array.from(dailyMap.entries()).map(([date, weight]) => ({ date, weight: Math.round(weight * 1000) / 1000 })),
    monthly: Array.from(monthlyMap.entries()).map(([ym, weight]) => ({ ym, weight: Math.round(weight * 1000) / 1000 })),
    byMaterial: Array.from(materialMap.entries()).map(([code, weight]) => ({ code, weight: Math.round(weight * 1000) / 1000 })),
  });
}
