/**
 * GET  /api/tbm/today?facilityId=N  — 오늘의 TBM 세션 + 본인 서명 여부
 * POST /api/tbm/today               — 매니저: 오늘 세션 생성/수정 (topic + content)
 *
 * facilityId 쿼리: AVAC 업체는 시설별 TBM 조회. 미전달 시 facilityId=NULL (전사 TBM).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';
import { getFacilityOperatorScope } from '@/lib/features';

export const runtime = 'nodejs';

const PostBody = z.object({
  topic: z.string().trim().min(2).max(255),
  content: z.string().trim().max(2000).optional(),
  facilityId: z.string().optional(),
  department: z.string().max(50).optional(),
  photoDataUrl: z.string().max(3_000_000).optional(),
  leader: z.string().trim().max(50).optional(),
  location: z.string().trim().max(100).optional(),
  hazards: z.string().trim().max(1000).optional(),
});

function parseTbmContent(raw: string | null): {
  text: string | null; photoDataUrl: string | null;
  leader: string | null; location: string | null; hazards: string | null;
} {
  if (!raw) return { text: null, photoDataUrl: null, leader: null, location: null, hazards: null };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') {
      return {
        text: p.text ?? null,
        photoDataUrl: p.photoDataUrl ?? null,
        leader: p.leader ?? null,
        location: p.location ?? null,
        hazards: p.hazards ?? null,
      };
    }
  } catch {}
  return { text: raw, photoDataUrl: null, leader: null, location: null, hazards: null };
}

function isManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ session: null, signed: false });

  const url = new URL(req.url);
  const facilityIdParam = url.searchParams.get('facilityId');
  const facilityId = facilityIdParam ? BigInt(facilityIdParam) : null;

  const today = todayKstDate();
  const tbm = await prisma.tbmSession.findFirst({
    where: {
      contractorId: BigInt(session.contractorId),
      facilityId: facilityId ?? null,
      sessionDate: today,
    },
    include: {
      creator: { select: { name: true } },
      signatures: { include: { worker: { select: { id: true, name: true } } }, orderBy: { signedAt: 'asc' } },
    },
  });

  let signed = false;
  if (tbm && session.role === 'WORKER') {
    signed = tbm.signatures.some((s) => s.workerId.toString() === session.userId);
  }

  /* 위탁업체 전체 근로자 수 (서명률 계산용) */
  const totalWorkers = await prisma.user.count({
    where: { role: 'WORKER', status: 'ACTIVE', contractorId: BigInt(session.contractorId) },
  });

  const parsed = parseTbmContent(tbm?.content ?? null);
  return NextResponse.json({
    session: tbm
      ? {
          id: tbm.id.toString(),
          sessionDate: tbm.sessionDate.toISOString().slice(0, 10),
          topic: tbm.topic,
          content: parsed.text,
          photoDataUrl: parsed.photoDataUrl,
          leader: parsed.leader,
          location: parsed.location,
          hazards: parsed.hazards,
          createdBy: tbm.creator.name,
          signCount: tbm.signatures.length,
          totalWorkers,
          facilityId: tbm.facilityId?.toString() ?? null,
          department: tbm.department ?? null,
          signers: tbm.signatures.map((s) => ({
            workerId: s.workerId.toString(),
            workerName: s.worker.name,
            signedAt: s.signedAt.toISOString(),
          })),
        }
      : null,
    signed,
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  // 시설 담당자 또는 TBM 매니저도 TBM 작성 허용
  if (!isManager(session.role)) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (!opScope.isFacilityOperator) {
      const me = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isTbmManager: true } });
      if (!me?.isTbmManager) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const today = todayKstDate();
  const contractorId = BigInt(session.contractorId);
  const department = parsed.data.department ?? null;

  /* 사진, 텍스트, 리더/장소/위험요인이 있으면 JSON으로 묶어 content 필드에 저장 */
  const { content: txt, photoDataUrl, leader, location, hazards } = parsed.data;
  let contentToStore: string | null = null;
  if (txt || photoDataUrl || leader || location || hazards) {
    contentToStore = JSON.stringify({
      text: txt ?? null,
      photoDataUrl: photoDataUrl ?? null,
      leader: leader ?? null,
      location: location ?? null,
      hazards: hazards ?? null,
    });
  }

  // 시설 담당자: 본인 집하장으로 강제 (다른 집하장 작성 차단)
  let facilityId = parsed.data.facilityId ? BigInt(parsed.data.facilityId) : null;
  if (!isManager(session.role)) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (opScope.primaryFacilityId) facilityId = opScope.primaryFacilityId;
  }

  // upsert: findFirst + update or create (@@unique 제거로 Prisma upsert 불가)
  const existing = await prisma.tbmSession.findFirst({
    where: { contractorId, facilityId, sessionDate: today, department },
  });

  const tbm = existing
    ? await prisma.tbmSession.update({
        where: { id: existing.id },
        data: { topic: parsed.data.topic, content: contentToStore },
      })
    : await prisma.tbmSession.create({
        data: {
          contractorId,
          facilityId,
          department,
          sessionDate: today,
          topic: parsed.data.topic,
          content: contentToStore,
          createdBy: BigInt(session.userId),
        },
      });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'TBM_SESSION_UPSERT',
      resourceType: 'tbm_session',
      resourceId: tbm.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { topic: parsed.data.topic, facilityId: facilityId?.toString() ?? null } as object,
    },
  });

  return NextResponse.json({ ok: true, sessionId: tbm.id.toString(), topic: tbm.topic });
}
