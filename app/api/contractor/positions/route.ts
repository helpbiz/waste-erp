// Design Ref: §4.1 — 업체별 직책 목록/추가. Plan SC: FR-03, FR-04
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
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
    return parseId(queryContractorId);
  }
  return parseId(session.contractorId);
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

  const rows = await prisma.contractorPosition.findMany({
    where: { contractorId: cid, ...(activeOnly ? { active: true } : {}) },
    include: { _count: { select: { users: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    positions: rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      sortOrder: r.sortOrder,
      active: r.active,
      userCount: r._count.users,
    })),
  });
}

const PostBody = z.object({
  contractorId: z.string().optional(),
  name: z.string().min(1).max(50),
  category: z.enum(['MANAGER', 'FIELD', 'ADMIN']),
  sortOrder: z.number().int().min(0).max(999).default(900),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const cid = await resolveContractorId(session, data.contractorId ?? null);
  if (!cid) return NextResponse.json({ error: 'contractorId required' }, { status: 400 });

  const existing = await prisma.contractorPosition.findUnique({
    where: { contractorId_name: { contractorId: cid, name: data.name } },
  });
  if (existing) return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });

  const pos = await prisma.contractorPosition.create({
    data: {
      contractorId: cid,
      name: data.name,
      category: data.category,
      sortOrder: data.sortOrder,
      createdBy: session.userId ? BigInt(session.userId) : null,
    },
  });

  await writeAudit(req, session, {
    action: 'contractor_position_create',
    resourceType: 'contractor_position',
    resourceId: String(pos.id),
    metadata: { name: data.name },
  });

  return NextResponse.json(
    { position: { id: String(pos.id), name: pos.name, category: pos.category, sortOrder: pos.sortOrder, active: pos.active, userCount: 0 } },
    { status: 201 },
  );
}
