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
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const includeExpired = url.searchParams.get('includeExpired') === 'true';
  const adminMode = url.searchParams.get('admin') === 'true' && ADMIN_ROLES.has(session.role);

  const now = new Date();
  const where: Prisma.AnnouncementWhereInput = {};

  if (!includeExpired && !adminMode) {
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
          { contractorId: null, municipalityId: null },                    // 시스템 전체 공지 (SUPER)
          ...(cId ? [{ contractorId: cId }] : []),                          // 본인 회사 공지
          ...(muniId ? [{ contractorId: null, municipalityId: muniId }] : []), // 본인 지자체 broadcast
        ],
      },
    ];
  }

  const items = await prisma.announcement.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    take: 50,
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

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id.toString(),
      title: a.title,
      body: a.body,
      severity: a.severity,
      audience: a.audience,
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
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!POSTER_ROLES.has(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* 회사별 기능 권한 — 공지사항 비활성 시 차단 (시스템·지자체 공지는 contractorId null 이므로 통과) */
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

  /* audience 정책 검증 — 작성자 role 에 허용된 값인지 강제
     CONTRACTOR/INTERNAL: ADMIN/WORKER/ALL 만, MUNI: OWNER/ADMIN/ALL 만 */
  if (!isAudienceAllowedFor(session.role, b.audience as AudienceValue)) {
    return NextResponse.json({ error: 'audience_not_allowed', audience: b.audience, role: session.role }, { status: 400 });
  }

  /* MUNI_ADMIN 작성 시 contractorId 는 null (지자체 산하 회사 broadcast),
     municipalityId 는 본인 지자체. CONTRACTOR/INTERNAL 은 본인 회사 한정. */
  const contractorId = session.role === 'MUNI_ADMIN' ? null : (session.contractorId ? BigInt(session.contractorId) : null);
  const municipalityId = session.municipalityId ? BigInt(session.municipalityId) : null;

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
