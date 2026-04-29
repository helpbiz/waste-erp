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
import { writeAudit } from '@/lib/audit';

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
    select: { id: true, companyName: true, municipalityId: true },
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

  /* SUPER cross-tenant 작업 — 작업 대상 contractor/muni를 audit_log에 명시 기록 */
  await writeAudit(req, session, {
    action: 'CONTRACTOR_UPDATE',
    resourceType: 'contractor',
    resourceId: id.toString(),
    contractorId: id,
    municipalityId: target.municipalityId,
    metadata: {
      fields: Object.keys(b),
      crossTenant: true,
      targetCompany: target.companyName,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE — §8 Q4=B 30일 soft-delete.
 *  - deletedAt = now() 설정 (실제 row 보존)
 *  - status='EXPIRED' 자동 설정
 *  - 30일 후 별도 cron(추후) 또는 수동 hard delete
 *  - FK 의존성 있어도 통과 (soft 이라 데이터 손실 없음)
 *  - 30일 내 /restore 로 즉시 복구 가능
 *
 *  ?hard=true 쿼리: SUPER_ADMIN 의 명시적 영구삭제 (FK 의존성 0 일 때만).
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const isHard = url.searchParams.get('hard') === 'true';

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
  const c = target._count;
  const total = c.users + c.vehicles + c.recyclingIntakes + c.complaints + c.attendances + c.wasteRecords;

  if (isHard) {
    /* 영구 삭제 — FK 의존성 0 필수 */
    if (total > 0) {
      return NextResponse.json(
        {
          error: 'has_dependencies',
          detail: `영구 삭제 차단: 연결된 데이터가 있습니다. (사용자 ${c.users} · 차량 ${c.vehicles} · 반입실적 ${c.recyclingIntakes} · 민원 ${c.complaints} · 근태 ${c.attendances} · 처리실적 ${c.wasteRecords})`,
          dependencies: c,
        },
        { status: 409 },
      );
    }
    await prisma.contractor.delete({ where: { id } });
    await writeAudit(req, session, {
      action: 'CONTRACTOR_HARD_DELETE',
      resourceType: 'contractor',
      resourceId: id.toString(),
      contractorId: id,
      municipalityId: target.municipalityId,
      metadata: { companyName: target.companyName, crossTenant: true },
    });
    return NextResponse.json({ ok: true, mode: 'hard' });
  }

  /* Soft delete — 항상 가능 */
  if (target) {
    /* 이미 soft-deleted 인지 확인 */
    const cur = await prisma.contractor.findUnique({ where: { id }, select: { deletedAt: true } });
    if (cur?.deletedAt) {
      return NextResponse.json({ error: 'already_deleted', deletedAt: cur.deletedAt.toISOString() }, { status: 409 });
    }
  }
  const now = new Date();
  await prisma.contractor.update({
    where: { id },
    data: { deletedAt: now, status: 'EXPIRED' },
  });
  await writeAudit(req, session, {
    action: 'CONTRACTOR_SOFT_DELETE',
    resourceType: 'contractor',
    resourceId: id.toString(),
    contractorId: id,
    municipalityId: target.municipalityId,
    metadata: {
      companyName: target.companyName,
      dependencies: c,
      restoreDeadline: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      crossTenant: true,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: 'soft',
    deletedAt: now.toISOString(),
    restoreDeadline: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
  });
}
