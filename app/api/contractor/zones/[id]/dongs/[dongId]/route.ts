/**
 * DELETE /api/contractor/zones/[id]/dongs/[dongId] — 행정동 제거
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
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

  const dongIdBig = parseId(params.dongId);
  const zoneIdBig = parseId(params.id);
  const dCid = parseId(session.contractorId);
  if (!dongIdBig || !zoneIdBig || !dCid) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const dong = await prisma.adminDong.findFirst({
    where: {
      id: dongIdBig,
      zoneId: zoneIdBig,
      contractorId: dCid,
    },
  });
  if (!dong) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.adminDong.delete({ where: { id: dong.id } });

  return NextResponse.json({ ok: true });
}
