/**
 * 작업자 익명 건의함 API.
 *
 * POST /api/worker/suggestion
 *   - WORKER 만. 익명 작성. body: { category, satisfactionScore, content, photos?, authorToken }
 *   - 서버는 authorToken 의 해시만 저장. 토큰 자체는 저장 안 함.
 *   - userId/IP/UA 일절 저장 금지.
 *
 * GET /api/worker/suggestion
 *   - 회사 전체 글 + 답변 (게시판형). 부서/직책 인원 < 3 명이면 마스킹.
 *   - 본인 글 식별: 클라가 X-Author-Token-Hash 헤더로 자기 토큰 해시 전달 →
 *     서버는 응답 each item 에 isMine boolean 부여.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { buildSmallGroupMasks, hashAuthorToken } from '@/lib/suggestions';

export const runtime = 'nodejs';

const CreateBody = z.object({
  category: z.enum(['WORK_ENV', 'EQUIPMENT', 'SAFETY', 'MANAGEMENT', 'WELFARE', 'OTHER']),
  satisfactionScore: z.number().int().min(1).max(5),
  content: z.string().min(5).max(4000),
  photos: z.array(z.string().max(500_000)).max(3).optional(),
  /** 클라가 발급해 localStorage 보관하는 UUID — 자기 글 식별용. */
  authorToken: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
  }
  const allowed = await hasFeature(session.contractorId, 'workerSuggestion');
  if (!allowed) {
    return NextResponse.json({ error: 'feature_disabled', feature: 'workerSuggestion' }, { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  /* 익명 메타 — 통계용. 서버가 세션에서 직접 조회 (위변조 방지). userId 는 저장 X */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { departmentId: true, position: { select: { code: true } } },
  });

  const created = await prisma.workerSuggestion.create({
    data: {
      contractorId: BigInt(session.contractorId),
      departmentId: me?.departmentId ?? null,
      positionCode: me?.position?.code ?? null,
      category: b.category,
      satisfactionScore: b.satisfactionScore,
      content: b.content.trim(),
      photos: b.photos && b.photos.length > 0 ? b.photos : undefined,
      authorTokenHash: hashAuthorToken(b.authorToken),
      // status 기본 NEW
    },
    select: { id: true, createdAt: true },
  });

  /* AuditLog: 작성 사실만 — 누구인지 actorId 도 저장하지 않는다(익명성).
     단, contractor 단위 감사용으로 시스템 사용자(0) 로 기록 */
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(0),
      actorRole: 'WORKER',
      action: 'WORKER_SUGGESTION_CREATE',
      resourceType: 'worker_suggestion',
      resourceId: created.id.toString(),
      contractorId: BigInt(session.contractorId),
      metadata: { category: b.category, score: b.satisfactionScore },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, id: created.id.toString(), createdAt: created.createdAt.toISOString() });
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!session.contractorId) return NextResponse.json({ items: [] });

  const allowed = await hasFeature(session.contractorId, 'workerSuggestion');
  if (!allowed) return NextResponse.json({ error: 'feature_disabled' }, { status: 403 });

  const url = new URL(req.url);
  const onlyMine = url.searchParams.get('mine') === '1';
  const myTokenHash = req.headers.get('x-author-token-hash') ?? '';

  const contractorId = BigInt(session.contractorId);
  const where: { contractorId: bigint; authorTokenHash?: string } = { contractorId };
  if (onlyMine) {
    if (!myTokenHash) return NextResponse.json({ items: [] });
    where.authorTokenHash = myTokenHash;
  }

  const rows = await prisma.workerSuggestion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { replier: { select: { name: true, role: true } } },
      },
      department: { select: { id: true, name: true } },
    },
  });

  const masks = await buildSmallGroupMasks(contractorId);

  return NextResponse.json({
    items: rows.map((r) => {
      const deptKey = r.departmentId?.toString() ?? null;
      const maskedDept = deptKey ? masks.smallDepartmentIds.has(deptKey) : true;
      const maskedPos = r.positionCode ? masks.smallPositionCodes.has(r.positionCode) : true;
      return {
        id: r.id.toString(),
        category: r.category,
        satisfactionScore: r.satisfactionScore,
        content: r.content,
        photos: (r.photos as string[] | null) ?? [],
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        /* 부서/직책 — 인원 < 3 면 null. 워커 화면에서는 부서명도 굳이 노출할 필요 적음. */
        departmentName: maskedDept ? null : r.department?.name ?? null,
        positionCode: maskedPos ? null : r.positionCode,
        isMine: !!myTokenHash && r.authorTokenHash === myTokenHash,
        replies: r.replies.map((rep) => ({
          id: rep.id.toString(),
          content: rep.content,
          createdAt: rep.createdAt.toISOString(),
          replierName: rep.replier.name,
          replierRole: rep.replier.role,
        })),
      };
    }),
  });
}
