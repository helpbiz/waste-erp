/**
 * POST /api/announcements/[id]/read — 현재 사용자 기준 공지 읽음 처리 (upsert)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const announcementId = parseId(params.id);
  if (announcementId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const userId = BigInt(session.userId);
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    create: { announcementId, userId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
