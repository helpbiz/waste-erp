/**
 * GET /api/admin/tbm-audience?managerId=N — 특정 TBM 등록권한자의 서명대상 프리셋 조회
 * PUT /api/admin/tbm-audience             — 프리셋 전체 교체 { managerId, workerIds: string[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const managerId = parseId(url.searchParams.get('managerId'));
  if (managerId == null) return NextResponse.json({ error: 'invalid_manager_id' }, { status: 400 });

  const manager = await prisma.user.findFirst({
    where: { id: managerId, contractorId: BigInt(session.contractorId), isTbmManager: true },
    select: { id: true },
  });
  if (!manager) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const rows = await prisma.tbmManagerAudience.findMany({
    where: { managerId },
    select: { workerId: true },
  });

  return NextResponse.json({ workerIds: rows.map((r) => r.workerId.toString()) });
}

const PutBody = z.object({
  managerId: z.string(),
  workerIds: z.array(z.string()).max(2000),
});

export async function PUT(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contractorId = BigInt(session.contractorId);
  const managerId = parseId(parsed.data.managerId);
  if (managerId == null) return NextResponse.json({ error: 'invalid_manager_id' }, { status: 400 });

  const manager = await prisma.user.findFirst({
    where: { id: managerId, contractorId, isTbmManager: true },
    select: { id: true },
  });
  if (!manager) return NextResponse.json({ error: 'manager_not_found' }, { status: 404 });

  const workerIds = parsed.data.workerIds
    .map((s) => parseId(s))
    .filter((id): id is bigint => id != null);

  /* 대상 워커가 모두 본인 계약업체 소속인지 검증 */
  if (workerIds.length > 0) {
    const validCount = await prisma.user.count({
      where: { id: { in: workerIds }, contractorId, role: 'WORKER' },
    });
    if (validCount !== workerIds.length) {
      return NextResponse.json({ error: 'invalid_worker_scope' }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.tbmManagerAudience.deleteMany({ where: { managerId } }),
    ...(workerIds.length > 0
      ? [prisma.tbmManagerAudience.createMany({
          data: workerIds.map((workerId) => ({ managerId, workerId })),
        })]
      : []),
  ]);

  return NextResponse.json({ ok: true, count: workerIds.length });
}
