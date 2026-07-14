/**
 * 공지사항 API.
 * GET  /api/announcements — 사용자 audience 에 맞는 활성 공지 목록
 * POST /api/announcements — 관리자 신규 공지 (SUPER/CONTRACTOR/INTERNAL_ADMIN)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import {
  isAudienceAllowedFor,
  visibleAudiencesForViewer,
  type AudienceValue,
} from '@/lib/announcement-audience';
import { getFacilityOperatorScope } from '@/lib/features';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/* 공지 작성 가능 role — MUNI_ADMIN 추가 (2026-05-02 사용자 요구사항).
   회사별 기능 권한은 contractor 작성에만 적용, MUNI 는 시스템 권한 */
const POSTER_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN']);
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

const Body = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  audience: z.enum(['ALL', 'OWNER', 'ADMIN', 'WORKER', 'MUNI']).default('ALL'),
  pinned: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  facilityId: z.string().optional(), // AVAC: 집하장별 공지
  attachmentUrls: z.array(z.string().max(2_000_000)).max(3).nullable().optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const includeExpired = url.searchParams.get('includeExpired') === 'true';
  const adminMode = url.searchParams.get('admin') === 'true' && ADMIN_ROLES.has(session.role);
  const facilityIdParam = url.searchParams.get('facilityId');
  const facilityId = facilityIdParam ? BigInt(facilityIdParam) : null;

  const now = new Date();
  const where: Prisma.AnnouncementWhereInput = {};

  if (!includeExpired) {
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gte: now } },
    ];
  }

  if (!adminMode) {
    /* 사용자 audience 필터 — role 별 가시 audience 정책 (lib/announcement-audience) */
    const visible = visibleAudiencesForViewer(session.role);
    where.audience = { in: visible };

    /* contractor scope — 회사 한정 + 지자체 broadcast 추가
       사용자 muniId 해상도: session.municipalityId 우선, 없으면 contractor 의 muni */
    const cId = session.contractorId ? BigInt(session.contractorId) : null;
    let muniId: bigint | null = session.municipalityId ? BigInt(session.municipalityId) : null;
    if (!muniId && cId) {
      const c = await prisma.contractor.findUnique({ where: { id: cId }, select: { municipalityId: true } });
      muniId = c?.municipalityId ?? null;
    }

    where.AND = [
      {
        OR: [
          { contractorId: null, municipalityId: null, facilityId: null }, // 시스템 전체 공지 (SUPER)
          ...(cId ? [{ contractorId: cId, facilityId: null }] : []),        // 본인 회사 공지 (시설 무관)
          ...(cId && facilityId ? [{ contractorId: cId, facilityId }] : []), // AVAC 집하장별 공지
          ...(muniId ? [{ contractorId: null, municipalityId: muniId, facilityId: null }] : []), // 지자체 broadcast
        ],
      },
      /* per-user targeting — null 이면 일반 broadcast, 값있으면 본인만 수신 */
      {
        OR: [
          { targetUserId: null },
          { targetUserId: BigInt(session.userId) },
        ],
      },
    ];
  }

  const items = await prisma.announcement.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    /* 관리자 모드(만료 포함 전체 조회)는 많은 자동공지(민원 등)로 50건 한도 초과 문제 발생 */
    take: adminMode ? 500 : 50,
  });

  /* author batch */
  const authorIds = Array.from(new Set(items.map((i) => i.createdBy)));
  const authors = authorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const authorMap = new Map(authors.map((a) => [a.id.toString(), a]));

  /* 현재 사용자의 읽음 여부 배치 조회 */
  const myUserId = BigInt(session.userId);
  const readRows = items.length > 0
    ? await prisma.announcementRead.findMany({
        where: { userId: myUserId, announcementId: { in: items.map((i) => i.id) } },
        select: { announcementId: true },
      })
    : [];
  const readSet = new Set(readRows.map((r) => r.announcementId.toString()));

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id.toString(),
      title: a.title,
      body: a.body,
      severity: a.severity,
      audience: a.audience,
      readByMe: readSet.has(a.id.toString()),
      pinned: a.pinned,
      publishedAt: a.publishedAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      /* updated == published 면 수정 안 됨, 그렇지 않으면 수정 이력 있음 */
      edited: a.updatedAt.getTime() - a.publishedAt.getTime() > 1000,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      authorName: authorMap.get(a.createdBy.toString())?.name ?? '시스템',
      authorRole: authorMap.get(a.createdBy.toString())?.role ?? null,
      authorId: a.createdBy.toString(),
      contractorId: a.contractorId?.toString() ?? null,
      municipalityId: a.municipalityId?.toString() ?? null,
      facilityId: a.facilityId?.toString() ?? null,
      attachmentUrls: (() => {
        if (!a.attachmentUrls) return null;
        try { return JSON.parse(a.attachmentUrls) as string[]; } catch { return null; }
      })(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 시설 담당자 체크 — POSTER_ROLES 아닌 WORKER도 담당 집하장 공지 작성 허용
  let operatorFacilityId: bigint | null = null;
  if (!POSTER_ROLES.has(session.role)) {
    const opScope = await getFacilityOperatorScope(session.userId);
    if (!opScope.isFacilityOperator || !opScope.primaryFacilityId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    operatorFacilityId = opScope.primaryFacilityId;
  }

  /* 회사별 기능 권한 — 공지사항 비활성 시 차단 */
  if (session.contractorId) {
    const allowed = await hasFeature(session.contractorId, 'announcements');
    if (!allowed) {
      return NextResponse.json({ error: 'feature_disabled', feature: 'announcements' }, { status: 403 });
    }
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  /* 시설 담당자: 반드시 본인 집하장 한정 공지만 작성 */
  if (operatorFacilityId) {
    if (!b.facilityId || BigInt(b.facilityId) !== operatorFacilityId) {
      return NextResponse.json({ error: 'operator_must_specify_own_facility' }, { status: 400 });
    }
  }

  /* audience 정책 검증 (시설 담당자는 WORKER role → WORKER/ALL audience 허용) */
  const effectiveRole = POSTER_ROLES.has(session.role) ? session.role : 'CONTRACTOR_ADMIN';
  if (!isAudienceAllowedFor(effectiveRole, b.audience as AudienceValue)) {
    return NextResponse.json({ error: 'audience_not_allowed', audience: b.audience, role: session.role }, { status: 400 });
  }

  /* MUNI_ADMIN: contractorId null, 지자체 broadcast.
     WORKER(시설담당자): 본인 회사 + 집하장 한정. */
  const contractorId = session.role === 'MUNI_ADMIN' ? null : (session.contractorId ? BigInt(session.contractorId) : null);
  const municipalityId = session.municipalityId ? BigInt(session.municipalityId) : null;
  const facilityId = operatorFacilityId ?? (b.facilityId ? BigInt(b.facilityId) : null);

  const created = await prisma.announcement.create({
    data: {
      title: b.title.trim(),
      body: b.body.trim(),
      severity: b.severity,
      audience: b.audience,
      pinned: b.pinned ?? false,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      createdBy: BigInt(session.userId),
      contractorId,
      municipalityId,
      facilityId,
      attachmentUrls: b.attachmentUrls?.length ? JSON.stringify(b.attachmentUrls) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'ANNOUNCEMENT_CREATE',
      resourceType: 'announcement',
      resourceId: created.id.toString(),
      contractorId: created.contractorId,
      municipalityId: created.municipalityId,
      metadata: { title: created.title, severity: created.severity, audience: created.audience },
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, id: created.id.toString() });
}
