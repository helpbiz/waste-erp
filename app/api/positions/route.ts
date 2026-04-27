/**
 * GET /api/positions — 활성 직책 마스터 목록 (캐시)
 * Design Ref: §4
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { listActivePositions } from '@/lib/positions';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const positions = await listActivePositions();
  return NextResponse.json({
    positions: positions.map((p) => ({
      id: p.id.toString(),
      code: p.code,
      label: p.label,
      category: p.category,
      sortOrder: p.sortOrder,
    })),
  });
}
