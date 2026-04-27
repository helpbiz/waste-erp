/**
 * PATCH  /api/super-admin/municipalities/[id] — 지자체 수정
 * DELETE /api/super-admin/municipalities/[id] — 비활성화 (soft delete: status=INACTIVE)
 *
 * 권한: SUPER_ADMIN 만
 * 안전장치: 산하 위탁업체가 있으면 DELETE 거부 (status=INACTIVE는 가능)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const PatchBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(50).nullable().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.municipality.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  const updated = await prisma.municipality.update({
    where: { id },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(b.region !== undefined ? { region: b.region } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'MUNICIPALITY_UPDATE',
      resourceType: 'municipality',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { changes: b, before: { name: target.name, region: target.region, status: target.status } } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    municipality: {
      id: updated.id.toString(),
      name: updated.name,
      code: updated.code,
      region: updated.region,
      status: updated.status,
    },
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.municipality.findUnique({
    where: { id },
    include: { _count: { select: { contractors: true } } },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* 산하 위탁업체 있으면 hard delete 거부 — INACTIVE 변경만 허용 */
  if (target._count.contractors > 0) {
    return NextResponse.json(
      {
        error: 'has_contractors',
        message: `산하 위탁업체 ${target._count.contractors}곳이 있어 삭제할 수 없습니다. 비활성화만 가능합니다.`,
      },
      { status: 409 },
    );
  }

  await prisma.municipality.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'MUNICIPALITY_DELETE',
      resourceType: 'municipality',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { name: target.name, code: target.code } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
