/**
 * POST /api/contractors/[id]/restore
 * §8 Q4=B 30일 soft-delete 복구.
 * - deletedAt = null 설정 → 정상 복귀
 * - status 는 변경하지 않음 (이전 EXPIRED 그대로 유지 — 운영자가 수동 ACTIVE 전환)
 * - 30일 경과 후 hard delete 된 항목은 복구 불가 (404)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const target = await prisma.contractor.findUnique({
    where: { id },
    select: { id: true, companyName: true, municipalityId: true, deletedAt: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!target.deletedAt) {
    return NextResponse.json({ error: 'not_deleted', detail: '이미 정상 상태입니다.' }, { status: 409 });
  }

  await prisma.contractor.update({
    where: { id },
    data: { deletedAt: null },
  });

  await writeAudit(req, session, {
    action: 'CONTRACTOR_RESTORE',
    resourceType: 'contractor',
    resourceId: id.toString(),
    contractorId: id,
    municipalityId: target.municipalityId,
    metadata: {
      companyName: target.companyName,
      previousDeletedAt: target.deletedAt.toISOString(),
      crossTenant: true,
    },
  });

  return NextResponse.json({ ok: true });
}
