/**
 * 공지사항 단건 — DELETE (관리자만, soft 비활성: expiresAt = now 처리)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ADMIN_ROLES.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.announcement.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.announcement.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'ANNOUNCEMENT_DELETE',
      resourceType: 'announcement',
      resourceId: id.toString(),
      contractorId: target.contractorId,
      metadata: { title: target.title },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
