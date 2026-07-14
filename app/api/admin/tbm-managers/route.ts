/**
 * GET /api/admin/tbm-managers — 현재 계약업체의 TBM 등록권한자(isTbmManager=true) 목록
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const items = await prisma.user.findMany({
    where: { contractorId: BigInt(session.contractorId), isTbmManager: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({
    items: items.map((u) => ({ id: u.id.toString(), name: u.name, role: u.role })),
  });
}
