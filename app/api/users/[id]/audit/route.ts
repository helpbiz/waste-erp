/**
 * GET /api/users/[id]/audit — 사용자 인적사항 변경 이력
 * 관리자(가시범위) 또는 본인만 조회 가능.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const isSelf = id.toString() === session.userId;

  if (!isSelf) {
    if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const target = await prisma.user.findFirst({ where: { id, ...userScope(session) }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      resourceType: 'user',
      resourceId: id.toString(),
      action: { in: ['USER_CREATE', 'USER_UPDATE', 'USER_DISABLE'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  /* actor 이름 조회 */
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter((x): x is bigint => x != null)));
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id.toString(), a.name]));

  return NextResponse.json({
    items: logs.map((l) => ({
      id: l.id.toString(),
      action: l.action,
      actorId: l.actorId?.toString() ?? null,
      actorName: l.actorId ? actorMap.get(l.actorId.toString()) ?? null : null,
      actorRole: l.actorRole,
      ipAddress: l.ipAddress,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
