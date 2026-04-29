/**
 * P2-2: 시스템 모니터링 통계.
 * 활성 사용자 / DB 사이즈 / 최근 에러율 / 누적 카운트.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 3600 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  /* DB 사이즈 (Postgres pg_database_size) — best-effort */
  let dbSizeMb: number | null = null;
  try {
    const r = await prisma.$queryRaw<Array<{ size: bigint }>>`SELECT pg_database_size(current_database()) as size`;
    if (r[0]?.size) dbSizeMb = Math.round(Number(r[0].size) / 1024 / 1024);
  } catch {
    /* 권한 부족 등 무시 */
  }

  const [
    totalUsers, activeUsers, lockedUsers,
    totalContractors, activeContractors,
    totalMunicipalities,
    loginSuccess24h, loginFailed24h, loginLocked24h,
    auditRecent7d,
    activeUsers7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.contractor.count(),
    prisma.contractor.count({ where: { status: 'ACTIVE' } }),
    prisma.municipality.count(),
    prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS', createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { action: 'LOGIN_LOCKED', createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
    prisma.user.count({ where: { lastLogin: { gte: last7d } } }),
  ]);

  /* 에러율 = LOGIN_FAILED / (LOGIN_SUCCESS + LOGIN_FAILED) */
  const totalLogin24h = loginSuccess24h + loginFailed24h;
  const errorRate24h = totalLogin24h > 0 ? Math.round((loginFailed24h / totalLogin24h) * 1000) / 10 : 0;

  return NextResponse.json({
    timestamp: now.toISOString(),
    db: {
      sizeMb: dbSizeMb,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      locked: lockedUsers,
      activeWithin7d: activeUsers7d,
    },
    contractors: {
      total: totalContractors,
      active: activeContractors,
    },
    municipalities: {
      total: totalMunicipalities,
    },
    login24h: {
      success: loginSuccess24h,
      failed: loginFailed24h,
      locked: loginLocked24h,
      errorRate: errorRate24h,
    },
    auditEvents7d: auditRecent7d,
  });
}
