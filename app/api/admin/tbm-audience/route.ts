/**
 * GET /api/admin/tbm-audience?managerId=N — 특정 TBM 등록권한자의 서명대상 프리셋 조회
 * PUT /api/admin/tbm-audience             — 프리셋 전체 교체 { managerId, workerIds: string[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';

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

  /* 2026-07-21 수정: 프리셋 저장이 "오늘" 이미 생성된 세션엔 반영 안 돼 관리자 체감상
     "저장해도 변경사항이 적용 안 됨"이 되던 문제 — 오늘 이 등록권한자가 만든 세션의
     서명대상도 즉시 동기화한다. 서명 여부와 무관하게 안전(대상 목록=조회/서명 가능 범위일
     뿐, 이미 기록된 tbm_signatures 는 이 테이블과 무관해 손대지 않음). */
  const todaysSessions = await prisma.tbmSession.findMany({
    where: { contractorId, createdBy: managerId, sessionDate: todayKstDate() },
    select: { id: true },
  });
  if (todaysSessions.length > 0) {
    const sessionIds = todaysSessions.map((s) => s.id);
    await prisma.$transaction([
      prisma.tbmSessionAudience.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      ...(workerIds.length > 0
        ? sessionIds.map((sessionId) =>
            prisma.tbmSessionAudience.createMany({
              data: workerIds.map((workerId) => ({ sessionId, workerId })),
            })
          )
        : []),
    ]);
  }

  return NextResponse.json({ ok: true, count: workerIds.length, syncedSessions: todaysSessions.length });
}
