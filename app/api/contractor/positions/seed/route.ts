// Design Ref: §4.5 — 온보딩 기본 직책·직급 seed. Plan SC: FR-10
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { DEFAULT_POSITIONS, DEFAULT_RANKS } from '@/lib/org-defaults';

export const runtime = 'nodejs';

const Body = z.object({ contractorId: z.string().optional() });

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let cid: bigint;
  if (session.role === 'SUPER_ADMIN' && parsed.data.contractorId) {
    cid = BigInt(parsed.data.contractorId);
  } else if (session.contractorId) {
    cid = BigInt(session.contractorId);
  } else {
    return NextResponse.json({ error: 'contractorId required' }, { status: 400 });
  }

  const createdBy = session.userId ? BigInt(session.userId) : null;

  for (const p of DEFAULT_POSITIONS) {
    await prisma.contractorPosition.upsert({
      where: { contractorId_name: { contractorId: cid, name: p.name } },
      update: {},
      create: { contractorId: cid, name: p.name, category: p.category, sortOrder: p.sortOrder, createdBy },
    });
  }

  for (const r of DEFAULT_RANKS) {
    await prisma.contractorRank.upsert({
      where: { contractorId_name: { contractorId: cid, name: r.name } },
      update: {},
      create: { contractorId: cid, name: r.name, level: r.level, sortOrder: r.sortOrder, createdBy },
    });
  }

  return NextResponse.json({ seeded: { positions: DEFAULT_POSITIONS.length, ranks: DEFAULT_RANKS.length } });
}
