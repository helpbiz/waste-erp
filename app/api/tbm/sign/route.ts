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

  const tbm = await prisma.tbmSession.findFirst({
    where: {
      contractorId: BigInt(session.contractorId),
      facilityId,
      scheduleId,
      sessionDate: today,
    },
    include: { audience: { select: { workerId: true } } },
  });
  if (!tbm) return NextResponse.json({ error: 'no_session_today' }, { status: 404 });
  if (tbm.audience.length > 0 && !tbm.audience.some((a) => a.workerId.toString() === session.userId)) {
    return NextResponse.json({ error: 'not_in_audience' }, { status: 403 });
  }

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
