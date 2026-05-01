/**
 * 공지사항 단건 — PATCH (수정) + DELETE (삭제).
 * 권한: 같은 회사 관리자 (SUPER_ADMIN 은 전체).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10_000).optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  audience: z.enum(['ALL', 'ADMIN', 'WORKER', 'MUNI']).optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

function canManage(session: { role: string; contractorId: string | null }, target: { contractorId: bigint | null }): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  if (!ADMIN_ROLES.has(session.role)) return false;
  /* 같은 회사 관리자 — contractorId 일치 또는 시스템 전체 공지 (target.contractorId=null 은 SUPER 만) */
  if (target.contractorId === null) return false; // 시스템 공지는 SUPER 만
  return session.contractorId === target.contractorId.toString();
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const target = await prisma.announcement.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canManage(session, target)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.title !== undefined) data.title = b.title.trim();
  if (b.body !== undefined) data.body = b.body.trim();
  if (b.severity !== undefined) data.severity = b.severity;
  if (b.audience !== undefined) data.audience = b.audience;
  if (b.pinned !== undefined) data.pinned = b.pinned;
  if (b.expiresAt !== undefined) data.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;

  await prisma.announcement.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'ANNOUNCEMENT_UPDATE',
      resourceType: 'announcement',
      resourceId: id.toString(),
      contractorId: target.contractorId,
      metadata: { title: target.title, fields: Object.keys(b) },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const target = await prisma.announcement.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canManage(session, target)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

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
