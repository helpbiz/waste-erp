/**
 * DELETE /api/delegations/[id] — 위임 규칙 즉시 종료 (active=false)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers, userScope } from '@/lib/users';

export const runtime = 'nodejs';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.delegationRule.findFirst({
    where: { id, delegator: userScope(session) },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.delegationRule.update({ where: { id }, data: { active: false, endsAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'DELEGATION_REVOKE',
      resourceType: 'delegation',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });
  return NextResponse.json({ ok: true });
}
