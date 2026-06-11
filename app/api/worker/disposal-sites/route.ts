/**
 * GET /api/worker/disposal-sites
 * 작업자가 처리실적/반입실적 입력 시 장소를 선택할 수 있도록 목록 조회.
 * WORKER 포함 위탁업체 소속 모든 역할 허용 (읽기 전용).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ items: [] });

  const items = await prisma.disposalSite.findMany({
    where: { contractorId: BigInt(session.contractorId), isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, address: true },
  });

  return NextResponse.json({
    items: items.map((s) => ({ id: s.id.toString(), name: s.name, address: s.address })),
  });
}
