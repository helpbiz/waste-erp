/** GET /api/super-admin/leads — 전체 리드 조회(기본 PENDING). 권한: SUPER_ADMIN. Design §5.4. */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { toLeadDTO } from '@/lib/types/dealer';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const leads = await prisma.lead.findMany({
    where: status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ items: leads.map(toLeadDTO) });
}
