/**
 * GET /api/worker/intake-categories
 * 작업자가 반입입력 시 성상을 선택할 수 있도록 목록 조회.
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

  const items = await prisma.intakeMaterialCategory.findMany({
    where: { contractorId: BigInt(session.contractorId), isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, label: true },
  });

  return NextResponse.json({
    items: items.map((c) => ({ id: c.id.toString(), label: c.label })),
  });
}
