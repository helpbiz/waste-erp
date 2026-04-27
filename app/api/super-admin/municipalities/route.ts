/**
 * GET  /api/super-admin/municipalities — 지자체 목록 (검색·필터·페이지네이션)
 * POST /api/super-admin/municipalities — 지자체 신규 등록
 *
 * 권한: SUPER_ADMIN 만
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma, MunicipalityStatus } from '@prisma/client';

export const runtime = 'nodejs';

const PostBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(2).max(20),
  region: z.string().trim().min(1).max(50).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const region = url.searchParams.get('region')?.trim() || '';
  const status = url.searchParams.get('status')?.trim() || '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  const where: Prisma.MunicipalityWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
    ];
  }
  if (region) where.region = region;
  if (status) where.status = status as MunicipalityStatus;

  const [items, total, regions] = await Promise.all([
    prisma.municipality.findMany({
      where,
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
      take: limit,
      skip: offset,
      include: {
        _count: { select: { contractors: true } },
      },
    }),
    prisma.municipality.count({ where }),
    /* 광역단체 목록 (필터 옵션용) */
    prisma.municipality.findMany({
      select: { region: true },
      where: { region: { not: null } },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    }),
  ]);

  /* 지자체별 MUNI_ADMIN 사용자 수 */
  const ids = items.map((m) => m.id);
  const adminCounts = ids.length > 0
    ? await prisma.user.groupBy({
        by: ['municipalityId'],
        where: { municipalityId: { in: ids }, role: 'MUNI_ADMIN' },
        _count: { _all: true },
      })
    : [];
  const adminCountMap = new Map(adminCounts.map((a) => [a.municipalityId?.toString() ?? '', a._count._all]));

  return NextResponse.json({
    total,
    items: items.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      code: m.code,
      region: m.region,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      contractorCount: m._count.contractors,
      adminCount: adminCountMap.get(m.id.toString()) ?? 0,
    })),
    regions: regions.map((r) => r.region).filter(Boolean) as string[],
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  /* 코드 중복 체크 */
  const exists = await prisma.municipality.findUnique({ where: { code: b.code } });
  if (exists) {
    return NextResponse.json({ error: 'code_already_exists' }, { status: 409 });
  }

  const created = await prisma.municipality.create({
    data: {
      name: b.name,
      code: b.code,
      region: b.region ?? null,
      status: b.status ?? 'ACTIVE',
      createdBy: BigInt(session.userId),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'MUNICIPALITY_CREATE',
      resourceType: 'municipality',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { name: b.name, code: b.code, region: b.region } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    municipality: {
      id: created.id.toString(),
      name: created.name,
      code: created.code,
      region: created.region,
      status: created.status,
    },
  });
}
