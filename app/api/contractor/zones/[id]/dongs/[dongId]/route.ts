/**
 * DELETE /api/contractor/zones/[id]/dongs/[dongId] — 행정동 제거
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; dongId: string } }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const dong = await prisma.adminDong.findFirst({
    where: {
      id: BigInt(params.dongId),
      zoneId: BigInt(params.id),
      contractorId: BigInt(session.contractorId),
    },
  });
  if (!dong) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.adminDong.delete({ where: { id: dong.id } });

  return NextResponse.json({ ok: true });
}
