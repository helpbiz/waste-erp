/**
 * POST /api/tbm/sign — 워커가 오늘 TBM 세션에 서명
 *  - 1인 1일 1회 (unique constraint)
 *  - 매니저는 서명 불가 (워커만)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';

export const runtime = 'nodejs';

const Body = z.object({
  signatureData: z.string()
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, 'data URL 형식 필요')
    .max(500_000, '500KB 초과 — 더 짧게 서명해 주세요')
    .optional(),
  facilityId: z.string().optional(), // AVAC: 시설별 TBM 서명 시 전달
  scheduleId: z.string().optional(), // 1일 최대 5회 시간지정 TBM 슬롯 — 미전달 시 레거시 단일 세션(scheduleId=null)
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'workers_only' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const today = todayKstDate();
  const facilityId = parseId(parsed.data.facilityId ?? null);
  const scheduleId = parseId(parsed.data.scheduleId ?? null);

  /* 2026-07-23 수정: 같은 날짜/시설/슬롯에 서로 다른 등록권한자가 department 구분 없이
     각자 세션을 만들면 동일 조건(facilityId·scheduleId·sessionDate)의 세션이 여러 건 존재할
     수 있다. 예전엔 findFirst로 아무거나 하나를 골라, 그 세션의 서명대상이 아닌 워커는
     실제로는 자기 팀 세션이 따로 있는데도 not_in_audience/no_session_today로 실패했음
     (2026-07-21~22 실사용자 보고). 이 워커가 실제 서명대상인 세션을 우선으로 찾는다. */
  const candidates = await prisma.tbmSession.findMany({
    where: {
      contractorId: BigInt(session.contractorId),
      facilityId,
      scheduleId,
      sessionDate: today,
    },
    include: { audience: { select: { workerId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const tbm =
    candidates.find((s) => s.audience.some((a) => a.workerId.toString() === session.userId)) ??
    candidates.find((s) => s.audience.length === 0) ??
    null;
  if (!tbm) return NextResponse.json({ error: 'no_session_today' }, { status: 404 });

  try {
    const sig = await prisma.tbmSignature.create({
      data: {
        sessionId: tbm.id,
        workerId: BigInt(session.userId),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        signatureData: parsed.data.signatureData ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'TBM_SIGN',
        resourceType: 'tbm_signature',
        resourceId: sig.id.toString(),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: { sessionId: tbm.id.toString(), topic: tbm.topic, hasSignatureImage: !!parsed.data.signatureData } as object,
      },
    });

    return NextResponse.json({
      ok: true,
      signedAt: sig.signedAt.toISOString(),
      sessionTopic: tbm.topic,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'already_signed' }, { status: 409 });
    }
    throw e;
  }
}
