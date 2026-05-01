/**
 * 공지사항 API.
 * GET  /api/announcements — 사용자 audience 에 맞는 활성 공지 목록
 * POST /api/announcements — 관리자 신규 공지 (SUPER/CONTRACTOR/INTERNAL_ADMIN)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

const Body = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  audience: z.enum(['ALL', 'ADMIN', 'WORKER', 'MUNI']).default('ALL'),
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
    /* 사용자 audience 필터 */
    const aud: string[] = ['ALL'];
    if (session.role === 'WORKER') aud.push('WORKER');
    else if (session.role === 'MUNI_ADMIN') aud.push('MUNI');
    else aud.push('ADMIN');
    where.audience = { in: aud };

    /* contractor scope — 회사 한정 공지 처리 */
    const cId = session.contractorId ? BigInt(session.contractorId) : null;
    where.AND = [
      {
        OR: [
          { contractorId: null }, // 전체 시스템 공지
          ...(cId ? [{ contractorId: cId }] : []),
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
  if (!ADMIN_ROLES.has(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const created = await prisma.announcement.create({
    data: {
      title: b.title.trim(),
      body: b.body.trim(),
      severity: b.severity,
      audience: b.audience,
      pinned: b.pinned ?? false,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      createdBy: BigInt(session.userId),
      contractorId: session.contractorId ? BigInt(session.contractorId) : null,
      municipalityId: session.municipalityId ? BigInt(session.municipalityId) : null,
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
