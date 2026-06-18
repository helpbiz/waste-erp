/**
 * PATCH /api/contractor/worker-zones/[id] — 담당구역 배정 수정
 * DELETE /api/contractor/worker-zones/[id] — 담당구역 배정 삭제
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PatchBody = z.object({
  addressType: z.enum(['road', 'lot']).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = session.contractorId;
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const existing = await prisma.workerZone.findFirst({
    where: { id: BigInt(params.id), contractorId: BigInt(contractorId) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const b = parsed.data;

  await prisma.workerZone.update({
    where: { id: BigInt(params.id) },
    data: {
      addressType: b.addressType ?? existing.addressType,
      address: b.address !== undefined ? (b.address?.trim() || null) : existing.address,
      memo: b.memo !== undefined ? (b.memo?.trim() || null) : existing.memo,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = session.contractorId;
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const existing = await prisma.workerZone.findFirst({
    where: { id: BigInt(params.id), contractorId: BigInt(contractorId) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.workerZone.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
