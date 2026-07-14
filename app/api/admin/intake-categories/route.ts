/**
 * GET  /api/admin/intake-categories — 반입입력 성상 목록
 * POST /api/admin/intake-categories — 성상 추가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

function isAllowed(role: string) {
  return ALLOWED.has(role);
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAllowed(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const items = await prisma.intakeMaterialCategory.findMany({
    where: { contractorId: BigInt(session.contractorId) },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, label: true, isActive: true, sortOrder: true },
  });

  return NextResponse.json({
    items: items.map((c) => ({ ...c, id: c.id.toString() })),
  });
}

const PostBody = z.object({
  label: z.string().trim().min(1).max(20),
  sortOrder: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAllowed(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contractorId = BigInt(session.contractorId);
  const existing = await prisma.intakeMaterialCategory.findFirst({
    where: { contractorId, label: parsed.data.label },
  });
  if (existing) return NextResponse.json({ error: 'already_exists' }, { status: 409 });

  const item = await prisma.intakeMaterialCategory.create({
    data: {
      contractorId,
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json({
    ok: true,
    item: { id: item.id.toString(), label: item.label, isActive: item.isActive, sortOrder: item.sortOrder },
  }, { status: 201 });
}
