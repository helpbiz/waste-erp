/**
 * GET  /api/admin/disposal-sites — 반입장소 목록
 * POST /api/admin/disposal-sites — 반입장소 추가
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

  const items = await prisma.disposalSite.findMany({
    where: { contractorId: BigInt(session.contractorId) },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, address: true, isActive: true, sortOrder: true },
  });

  return NextResponse.json({
    items: items.map((s) => ({ ...s, id: s.id.toString() })),
  });
}

const PostBody = z.object({
  name: z.string().trim().min(1).max(50),
  address: z.string().trim().max(255).optional(),
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

  const item = await prisma.disposalSite.create({
    data: {
      contractorId: BigInt(session.contractorId),
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ ok: true, item: { id: item.id.toString(), name: item.name, address: item.address, isActive: item.isActive, sortOrder: item.sortOrder } }, { status: 201 });
}
