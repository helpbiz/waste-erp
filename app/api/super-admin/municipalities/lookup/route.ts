/**
 * GET /api/super-admin/municipalities/lookup?q=강남
 * 지자체 자동완성 검색 — 신규 등록 모달의 이름/코드 자동 채움용
 *
 * 권한: SUPER_ADMIN 만
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 1) return NextResponse.json({ items: [] });

  const items = await prisma.municipality.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { code: { contains: q } },
        { region: { contains: q } },
      ],
    },
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
    take: 30,
    include: { _count: { select: { contractors: true } } },
  });

  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      code: m.code,
      region: m.region,
      status: m.status,
      contractorCount: m._count.contractors,
    })),
  });
}
