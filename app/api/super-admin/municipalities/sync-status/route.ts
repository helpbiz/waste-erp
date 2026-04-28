/**
 * POST /api/super-admin/municipalities/sync-status
 *
 * 위탁업체 운영 여부 기준으로 지자체 상태 일괄 동기화:
 *   - 위탁업체 0곳 + status=ACTIVE → status=SUSPENDED (휴면)
 *   - 위탁업체 1곳+ + status=SUSPENDED/PENDING → status=ACTIVE (재활성화)
 *
 * 권한: SUPER_ADMIN 만
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  /* 1. 위탁업체 없는 ACTIVE → SUSPENDED */
  const munis = await prisma.municipality.findMany({
    select: { id: true, name: true, code: true, status: true, _count: { select: { contractors: true } } },
  });

  let toSuspend: bigint[] = [];
  let toActivate: bigint[] = [];

  for (const m of munis) {
    if (m._count.contractors === 0 && m.status === 'ACTIVE') {
      toSuspend.push(m.id);
    } else if (m._count.contractors > 0 && m.status !== 'ACTIVE') {
      toActivate.push(m.id);
    }
  }

  /* 2. 일괄 업데이트 */
  if (toSuspend.length > 0) {
    await prisma.municipality.updateMany({
      where: { id: { in: toSuspend } },
      data: { status: 'SUSPENDED' },
    });
  }
  if (toActivate.length > 0) {
    await prisma.municipality.updateMany({
      where: { id: { in: toActivate } },
      data: { status: 'ACTIVE' },
    });
  }

  /* 3. 감사 로그 — bulk operation, muni 단일 ID 없음 */
  await writeAudit(req, session, {
    action: 'MUNICIPALITY_SYNC_STATUS',
    resourceType: 'municipality',
    metadata: {
      suspended: toSuspend.length,
      activated: toActivate.length,
      total: munis.length,
      suspendedIds: toSuspend.map((id) => id.toString()),
      activatedIds: toActivate.map((id) => id.toString()),
      crossTenant: true,
    },
  });

  return NextResponse.json({
    ok: true,
    suspended: toSuspend.length,   // ACTIVE → SUSPENDED 전환 수
    activated: toActivate.length,  // SUSPENDED/PENDING → ACTIVE 전환 수
    total: munis.length,
  });
}
