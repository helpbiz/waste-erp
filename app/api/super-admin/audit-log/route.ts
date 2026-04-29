/**
 * P2-3: 감사 로그 뷰어 — 모든 audit_log 검색·필터·페이지네이션.
 * 5년 보존 의무 (산업안전보건법) — 본 API는 SUPER_ADMIN 만.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action')?.trim();
  const resourceType = url.searchParams.get('resourceType')?.trim();
  const actorRole = url.searchParams.get('actorRole')?.trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 50));

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (resourceType) where.resourceType = resourceType;
  if (actorRole && ['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER'].includes(actorRole)) {
    where.actorRole = actorRole as Prisma.AuditLogWhereInput['actorRole'];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00Z');
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  /* actor 사용자명 한 번에 조회 (N+1 회피) */
  const actorIds = Array.from(new Set(items.map((i) => i.actorId).filter((x): x is bigint => x !== null)));
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, username: true, name: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id.toString(), { username: a.username, name: a.name }]));

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id.toString(),
      actorId: i.actorId?.toString() ?? null,
      actorRole: i.actorRole,
      actor: i.actorId ? actorMap.get(i.actorId.toString()) ?? null : null,
      action: i.action,
      resourceType: i.resourceType,
      resourceId: i.resourceId,
      contractorId: i.contractorId?.toString() ?? null,
      municipalityId: i.municipalityId?.toString() ?? null,
      ipAddress: i.ipAddress,
      metadata: i.metadata,
      createdAt: i.createdAt.toISOString(),
    })),
    total, page, limit,
  });
}
