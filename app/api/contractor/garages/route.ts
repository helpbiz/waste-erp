/**
 * GET  /api/contractor/garages  — 차고지 목록
 * POST /api/contractor/garages  — 차고지 추가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PostBody = z.object({
  name:    z.string().trim().max(50).optional(),
  address: z.string().trim().min(1).max(255),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  if (!session.contractorId) return NextResponse.json({ garages: [] });

  const garages = await prisma.garage.findMany({
    where: { contractorId: BigInt(session.contractorId) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, address: true, createdAt: true },
  });

  return NextResponse.json({
    garages: garages.map((g) => ({
      id: g.id.toString(),
      name: g.name,
      address: g.address,
      createdAt: g.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { name, address } = parsed.data;

  const garage = await prisma.garage.create({
    data: {
      contractorId: BigInt(session.contractorId),
      name: name || null,
      address,
    },
  });

  return NextResponse.json({ id: garage.id.toString() }, { status: 201 });
}
