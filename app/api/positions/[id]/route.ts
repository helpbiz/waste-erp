/**
 * PATCH /api/positions/[id] — 직책 라벨/카테고리/정렬/활성 수정 (조직도 셋업).
 * 사용자 요청 2026-04-29: 회사 관리자가 조직도 셋업 시 직책 수정 가능.
 *
 * ⚠ Position 은 전역 모델 (no contractorId). 한 회사 변경이 모든 회사에 영향.
 *    향후 contractor-scoped position 으로 schema 변경 검토 필요.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Patch = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  category: z.enum(['OFFICE', 'FIELD', 'OTHER']).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.position.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  if (b.label !== undefined) data.label = b.label;
  if (b.category !== undefined) data.category = b.category;
  if (b.sortOrder !== undefined) data.sortOrder = b.sortOrder;
  if (b.active !== undefined) data.active = b.active;

  await prisma.position.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'POSITION_UPDATE',
      resourceType: 'position',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(data), code: target.code } as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ ok: true });
}
