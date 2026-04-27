/**
 * PATCH  /api/contractors/[id] — 위탁업체 기본 정보 수정 (SUPER_ADMIN 전용)
 *   body: { companyName?, contractStart?, contractEnd?, status? }
 * DELETE /api/contractors/[id] — 위탁업체 삭제 (SUPER_ADMIN 전용)
 *   FK 의존성 (users/vehicles/intakes 등) 있으면 409 Conflict
 *
 * 회사 상세(차고지·연락처)는 /api/contractor/info PATCH 그대로 사용 — 분리.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const PatchBody = z.object({
  companyName: z.string().min(1).max(100).optional(),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  contractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['SETUP', 'ACTIVE', 'EXPIRED']).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.contractor.findUnique({
    where: { id },
    select: { id: true, companyName: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.companyName !== undefined) data.companyName = b.companyName;
  if (b.status !== undefined) data.status = b.status;
  if (b.contractStart !== undefined) {
    data.contractStart = b.contractStart ? new Date(b.contractStart + 'T00:00:00Z') : null;
  }
  if (b.contractEnd !== undefined) {
    data.contractEnd = b.contractEnd ? new Date(b.contractEnd + 'T00:00:00Z') : null;
  }

  await prisma.contractor.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_UPDATE',
      resourceType: 'contractor',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(b) } as object,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.contractor.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          vehicles: true,
          recyclingIntakes: true,
          complaints: true,
          attendances: true,
          wasteRecords: true,
        },
      },
    },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* FK 의존성 검증 — 운영 데이터가 있으면 삭제 차단 */
  const c = target._count;
  const total = c.users + c.vehicles + c.recyclingIntakes + c.complaints + c.attendances + c.wasteRecords;
  if (total > 0) {
    return NextResponse.json(
      {
        error: 'has_dependencies',
        detail: `이 업체에 연결된 데이터가 있어 삭제할 수 없습니다. (사용자 ${c.users} · 차량 ${c.vehicles} · 반입실적 ${c.recyclingIntakes} · 민원 ${c.complaints} · 근태 ${c.attendances} · 처리실적 ${c.wasteRecords})`,
        dependencies: c,
      },
      { status: 409 },
    );
  }

  await prisma.contractor.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_DELETE',
      resourceType: 'contractor',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { companyName: target.companyName } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
