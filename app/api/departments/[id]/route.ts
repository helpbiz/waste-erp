/**
 * PATCH /api/departments/[id] — 부서장(headUserId) 변경, 이름·정렬 수정
 * DELETE /api/departments/[id] — 비활성화 (소속 사용자 0명일 때만)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers, userScope } from '@/lib/users';

export const runtime = 'nodejs';

const Patch = z.object({
  headUserId: z.string().nullable().optional(),
  name: z.string().min(1).max(60).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.department.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && target.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.sortOrder !== undefined) data.sortOrder = b.sortOrder;
  if (b.parentId !== undefined) data.parentId = b.parentId ? BigInt(b.parentId) : null;
  if (b.headUserId !== undefined) {
    if (b.headUserId === null) {
      data.headUserId = null;
    } else {
      /* 부서장은 본인 위탁업체 + 가시범위 사용자 */
      const head = await prisma.user.findFirst({
        where: { id: BigInt(b.headUserId), contractorId: target.contractorId, ...userScope(session) },
        select: { id: true },
      });
      if (!head) return NextResponse.json({ error: 'invalid_head_user' }, { status: 400 });
      data.headUserId = head.id;
    }
  }

  await prisma.department.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'DEPARTMENT_UPDATE',
      resourceType: 'department',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(data) } as object,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { users: true, children: true } } } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target._count.users > 0 || target._count.children > 0) {
    return NextResponse.json({ error: 'has_dependents', users: target._count.users, children: target._count.children }, { status: 409 });
  }
  await prisma.department.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
