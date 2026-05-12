/**
 * PATCH  /api/admin/disposal-sites/[id] — 수정
 * DELETE /api/admin/disposal-sites/[id] — 삭제
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PatchBody = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = BigInt(params.id);
  const target = await prisma.disposalSite.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const updated = await prisma.disposalSite.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true, item: { id: updated.id.toString(), name: updated.name, isActive: updated.isActive, sortOrder: updated.sortOrder } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = BigInt(params.id);
  const target = await prisma.disposalSite.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.disposalSite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
