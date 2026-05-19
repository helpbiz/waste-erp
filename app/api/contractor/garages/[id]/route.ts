/**
 * DELETE /api/contractor/garages/[id]  — 차고지 삭제
 * PATCH  /api/contractor/garages/[id]  — 차고지 수정 (이름/주소)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PatchBody = z.object({
  name:    z.string().trim().max(50).optional(),
  address: z.string().trim().min(1).max(255).optional(),
});

async function resolveGarage(id: string, contractorId: string) {
  return prisma.garage.findFirst({
    where: { id: BigInt(id), contractorId: BigInt(contractorId) },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const garage = await resolveGarage(params.id, session.contractorId);
  if (!garage) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.garage.delete({ where: { id: garage.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const garage = await resolveGarage(params.id, session.contractorId);
  if (!garage) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updated = await prisma.garage.update({
    where: { id: garage.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name || null }),
      ...(parsed.data.address && { address: parsed.data.address }),
    },
  });

  return NextResponse.json({ id: updated.id.toString() });
}
