/**
 * P2-1: 전체 사용자 검색 (모든 회사·모든 지자체).
 * 권한: SUPER_ADMIN 전용.
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
  const q = url.searchParams.get('q')?.trim() ?? '';
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const lockedOnly = url.searchParams.get('lockedOnly') === 'true';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 50));

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { username: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { employeeNo: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role && ['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER'].includes(role)) {
    where.role = role as Prisma.UserWhereInput['role'];
  }
  if (status && ['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
    where.status = status as Prisma.UserWhereInput['status'];
  }
  if (lockedOnly) {
    where.lockedUntil = { gt: new Date() };
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, username: true, name: true, role: true, status: true,
        contractorId: true, municipalityId: true, lastLogin: true,
        failedLoginAttempts: true, lockedUntil: true,
        contractor: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  /* Municipality 별도 조회 (User 모델에 직접 relation 없음) — N+1 회피 위해 batch */
  const muniIds = Array.from(new Set(items.map((u) => u.municipalityId).filter((x): x is bigint => x !== null)));
  const munis = muniIds.length > 0
    ? await prisma.municipality.findMany({
        where: { id: { in: muniIds } },
        select: { id: true, name: true },
      })
    : [];
  const muniMap = new Map(munis.map((m) => [m.id.toString(), m.name]));

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      contractorName: u.contractor?.companyName ?? null,
      municipalityName: u.municipalityId ? muniMap.get(u.municipalityId.toString()) ?? null : null,
      lastLogin: u.lastLogin?.toISOString() ?? null,
      failedLoginAttempts: u.failedLoginAttempts,
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      isLocked: u.lockedUntil ? u.lockedUntil > new Date() : false,
    })),
    total,
    page,
    limit,
  });
}
