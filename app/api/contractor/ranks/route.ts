// Design Ref: §4.3 — 업체별 직급 목록/추가. Plan SC: FR-06
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

async function resolveContractorId(
  session: { role: string; contractorId: string | null },
  queryContractorId: string | null,
): Promise<bigint | null> {
  if (session.role === 'SUPER_ADMIN') {
    return queryContractorId ? BigInt(queryContractorId) : null;
  }
  if (session.contractorId) return BigInt(session.contractorId);
  return null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const cid = await resolveContractorId(session, url.searchParams.get('contractorId'));
  if (!cid) return NextResponse.json({ error: 'contractorId required' }, { status: 400 });

  const activeOnly = url.searchParams.get('active') !== 'all';

  const rows = await prisma.contractorRank.findMany({
    where: { contractorId: cid, ...(activeOnly ? { active: true } : {}) },
    include: { _count: { select: { users: true } } },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
  });

  return NextResponse.json({
    ranks: rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      level: r.level,
      sortOrder: r.sortOrder,
      active: r.active,
      userCount: r._count.users,
    })),
  });
}

const PostBody = z.object({
  contractorId: z.string().optional(),
  name: z.string().min(1).max(50),
  level: z.number().int().min(1).max(99).default(99),
  sortOrder: z.number().int().min(0).max(999).default(900),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const cid = await resolveContractorId(session, data.contractorId ?? null);
  if (!cid) return NextResponse.json({ error: 'contractorId required' }, { status: 400 });

  const existing = await prisma.contractorRank.findUnique({
    where: { contractorId_name: { contractorId: cid, name: data.name } },
  });
  if (existing) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });

  const rank = await prisma.contractorRank.create({
    data: {
      contractorId: cid,
      name: data.name,
      level: data.level,
      sortOrder: data.sortOrder,
      createdBy: session.userId ? BigInt(session.userId) : null,
    },
  });

  await writeAudit(req, session, {
    action: 'contractor_rank_create',
    resourceType: 'contractor_rank',
    resourceId: String(rank.id),
    metadata: { name: data.name },
  });

  return NextResponse.json(
    { rank: { id: String(rank.id), name: rank.name, level: rank.level, sortOrder: rank.sortOrder, active: rank.active, userCount: 0 } },
    { status: 201 },
  );
}
