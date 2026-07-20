/**
 * GET  /api/tbm/today?facilityId=N&scheduleId=N  — 오늘의 TBM 세션 + 본인 서명 여부
 * POST /api/tbm/today                            — 매니저: 오늘 세션 생성/수정 (topic + content + scheduleId)
 *
 * facilityId 쿼리: AVAC 업체는 시설별 TBM 조회. 미전달 시 facilityId=NULL (전사 TBM).
 * scheduleId 쿼리: 1일 최대 5회 시간지정 TBM 슬롯 — 미전달 시 scheduleId=NULL(레거시 단일 세션) 기준으로 `session`/`signed` 계산.
 *   `sessions[]` 에는 오늘 등록된 모든 슬롯의 세션이 담기며, WORKER 조회 시 본인이 서명대상(TbmSessionAudience)에
 *   포함된(또는 서명대상 프리셋이 없는) 세션만 필터링되어 내려간다.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
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
  scheduleId: z.string().optional(),
  department: z.string().max(50).optional(),
  photoDataUrl: z.string().max(3_000_000).optional(),
  leader: z.string().trim().max(50).optional(),
  location: z.string().trim().max(100).optional(),
  hazards: z.string().trim().max(1000).optional(),
  preWorkCheck: z.string().trim().max(1000).optional(),
});

function parseTbmContent(raw: string | null): {
  text: string | null; photoDataUrl: string | null;
  leader: string | null; location: string | null; hazards: string | null; preWorkCheck: string | null;
} {
  const empty = { text: null, photoDataUrl: null, leader: null, location: null, hazards: null, preWorkCheck: null };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') {
      return {
        text:         p.text         ?? null,
        photoDataUrl: p.photoDataUrl ?? null,
        leader:       p.leader       ?? null,
        location:     p.location     ?? null,
        hazards:      p.hazards      ?? null,
        preWorkCheck: p.preWorkCheck ?? null,
      };
    }
  } catch {}
  return { text: raw, photoDataUrl: null, leader: null, location: null, hazards: null, preWorkCheck: null };
}

function isManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ session: null, signed: false, sessions: [], schedules: [] });

  const url = new URL(req.url);
  const facilityIdParam = url.searchParams.get('facilityId');
  const facilityId = parseId(facilityIdParam);
  const scheduleIdParam = url.searchParams.get('scheduleId');
  const scheduleId = parseId(scheduleIdParam);

  const contractorId = BigInt(session.contractorId);
  const today = todayKstDate();

  const [allSessions, schedules] = await Promise.all([
    prisma.tbmSession.findMany({
      where: { contractorId, facilityId: facilityId ?? null, sessionDate: today },
      include: {
        creator: { select: { name: true } },
        schedule: { select: { id: true, label: true, timeOfDay: true, sortOrder: true } },
        signatures: { include: { worker: { select: { id: true, name: true } } }, orderBy: { signedAt: 'asc' } },
        audience: { select: { workerId: true } },
      },
    }),
    prisma.tbmSchedule.findMany({
      where: { contractorId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, label: true, timeOfDay: true },
    }),
  ]);
  allSessions.sort((a, b) => (a.schedule?.sortOrder ?? -1) - (b.schedule?.sortOrder ?? -1));

  /* 전사 TBM 대상 워커 수 (excludeFromTbm 부서 제외) — 세션별 서명대상 프리셋이 없을 때의 fallback */
  const totalWorkersCompanyWide = await prisma.user.count({
    where: {
      role: 'WORKER',
      status: 'ACTIVE',
      contractorId,
      OR: [{ departmentId: null }, { department: { excludeFromTbm: false } }],
    },
  });

  const myUserId = session.role === 'WORKER' ? session.userId : null;

  function toSessionInfo(tbm: (typeof allSessions)[number]) {
    const parsed = parseTbmContent(tbm.content ?? null);
    const audienceIds = tbm.audience.length > 0 ? new Set(tbm.audience.map((a) => a.workerId.toString())) : null;
    return {
      id: tbm.id.toString(),
      sessionDate: tbm.sessionDate.toISOString().slice(0, 10),
      topic: tbm.topic,
      content: parsed.text,
      photoDataUrl: parsed.photoDataUrl,
      leader: parsed.leader,
      location: parsed.location,
      hazards: parsed.hazards,
      preWorkCheck: parsed.preWorkCheck,
      createdBy: tbm.creator.name,
      signCount: tbm.signatures.length,
      totalWorkers: audienceIds ? audienceIds.size : totalWorkersCompanyWide,
      facilityId: tbm.facilityId?.toString() ?? null,
      department: tbm.department ?? null,
      scheduleId: tbm.scheduleId?.toString() ?? null,
      scheduleLabel: tbm.schedule?.label ?? null,
      hasAudiencePreset: !!audienceIds,
      signed: myUserId ? tbm.signatures.some((s) => s.workerId.toString() === myUserId) : false,
      signers: tbm.signatures.map((s) => ({
        workerId: s.workerId.toString(),
        workerName: s.worker.name,
        signedAt: s.signedAt.toISOString(),
      })),
    };
  }

  /* WORKER 는 서명대상 프리셋이 없거나(전체 대상) 본인이 대상에 포함된 세션만 조회 가능 */
  const visibleSessions = session.role === 'WORKER'
    ? allSessions.filter((s) => s.audience.length === 0 || s.audience.some((a) => a.workerId.toString() === session.userId))
    : allSessions;

  const selected = allSessions.find((s) => (s.scheduleId?.toString() ?? null) === (scheduleId?.toString() ?? null)) ?? null;
  const selectedVisible = selected && (session.role !== 'WORKER' || visibleSessions.includes(selected));
  const selectedInfo = selectedVisible ? toSessionInfo(selected!) : null;

  return NextResponse.json({
    session: selectedInfo,
    signed: selectedInfo?.signed ?? false,
    sessions: visibleSessions.map(toSessionInfo),
    schedules: schedules.map((s) => ({ id: s.id.toString(), label: s.label, timeOfDay: s.timeOfDay })),
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

  /* 시간 슬롯 검증 — 지정한 scheduleId 는 본인 계약업체의 활성 슬롯이어야 함 */
  let scheduleId: bigint | null = null;
  if (parsed.data.scheduleId) {
    const sched = await prisma.tbmSchedule.findFirst({
      where: { id: BigInt(parsed.data.scheduleId), contractorId, isActive: true },
      select: { id: true },
    });
    if (!sched) return NextResponse.json({ error: 'invalid_schedule' }, { status: 400 });
    scheduleId = sched.id;
  }

  /* 사진, 텍스트, 리더/장소/위험요인이 있으면 JSON으로 묶어 content 필드에 저장 */
  const { content: txt, photoDataUrl, leader, location, hazards, preWorkCheck } = parsed.data;
  let contentToStore: string | null = null;
  if (txt || photoDataUrl || leader || location || hazards || preWorkCheck) {
    contentToStore = JSON.stringify({
      text:         txt          ?? null,
      photoDataUrl: photoDataUrl ?? null,
      leader:       leader       ?? null,
      location:     location     ?? null,
      hazards:      hazards      ?? null,
      preWorkCheck: preWorkCheck ?? null,
    });
  }

  // 시설 담당자: 본인 집하장으로 강제 (다른 집하장 작성 차단)
  let facilityId = parseId(parsed.data.facilityId ?? null);
  if (!isManager(session.role)) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (opScope.primaryFacilityId) facilityId = opScope.primaryFacilityId;
  }

  /* 같은 날짜/시간대/부서/시설의 최신 세션 — 있어도 무조건 덮어쓰지 않는다.
     본인이 작성했고 아직 서명이 하나도 없는 경우에만 "수정"(update), 그 외(다른 작성자이거나
     이미 서명이 있는 경우)에는 새 세션을 생성해 그날 작성된 건이 전부 누적되도록 한다. */
  const existing = await prisma.tbmSession.findFirst({
    where: { contractorId, facilityId, sessionDate: today, department, scheduleId },
    orderBy: { createdAt: 'desc' },
  });

  const existingSignatureCount = existing
    ? await prisma.tbmSignature.count({ where: { sessionId: existing.id } })
    : 0;
  const canEditInPlace = !!existing
    && existing.createdBy === BigInt(session.userId)
    && existingSignatureCount === 0;

  const tbm = canEditInPlace
    ? await prisma.tbmSession.update({
        where: { id: existing!.id },
        data: { topic: parsed.data.topic, content: contentToStore },
      })
    : await prisma.tbmSession.create({
        data: {
          contractorId,
          facilityId,
          department,
          scheduleId,
          sessionDate: today,
          topic: parsed.data.topic,
          content: contentToStore,
          createdBy: BigInt(session.userId),
        },
      });

  /* 등록권한자(작성자)의 서명대상 프리셋을 세션에 스냅샷 — 신규 생성이든 제자리 수정이든 이 시점엔
     항상 서명 0건(canEditInPlace 조건 또는 신규 생성)이므로 매번 최신 프리셋으로 재동기화해도 안전.
     2026-07-20 수정: 기존엔 신규 생성 시에만 스냅샷해서, 세션 생성 후 관리자가 프리셋을 바꿔도
     이미 만들어진 오늘 세션에는 반영되지 않아 "설정했는데 전체 인원이 조회됨" 문제가 있었음.
     프리셋 없으면 전체 대상(기존 동작) 유지하기 위해 스냅샷은 비워둠(기존 행 삭제만). */
  await prisma.tbmSessionAudience.deleteMany({ where: { sessionId: tbm.id } });
  const preset = await prisma.tbmManagerAudience.findMany({
    where: { managerId: BigInt(session.userId) },
    select: { workerId: true },
  });
  if (preset.length > 0) {
    await prisma.tbmSessionAudience.createMany({
      data: preset.map((p) => ({ sessionId: tbm.id, workerId: p.workerId })),
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'TBM_SESSION_UPSERT',
      resourceType: 'tbm_session',
      resourceId: tbm.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { topic: parsed.data.topic, facilityId: facilityId?.toString() ?? null, scheduleId: scheduleId?.toString() ?? null } as object,
    },
  });

  return NextResponse.json({ ok: true, sessionId: tbm.id.toString(), topic: tbm.topic });
}
