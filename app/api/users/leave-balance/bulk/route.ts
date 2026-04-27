/**
 * POST /api/users/leave-balance/bulk — 일괄 연차 부여 (관리자)
 *  body: { year, mode: 'all' | 'role' | 'list', role?, workerIds?, granted?, useRecommend?, carriedOver? }
 *   - all: 본인 위탁업체 ACTIVE WORKER 전원
 *   - role: 특정 role (WORKER/INTERNAL_ADMIN 등) 전체
 *   - list: workerIds 배열
 *   - useRecommend=true 시 각 워커 입사일 기반 권장 일수 자동 계산
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers, recommendedAnnualLeaveDays } from '@/lib/users';

export const runtime = 'nodejs';

const Body = z.object({
  year: z.number().int().min(2020).max(2100),
  mode: z.enum(['all', 'role', 'list']),
  role: z.enum(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER']).optional(),
  workerIds: z.array(z.string()).optional(),
  granted: z.number().min(0).max(50).optional(),
  useRecommend: z.boolean().optional(),
  carriedOver: z.number().min(0).max(50).optional(),
  note: z.string().max(255).optional(),
  overwrite: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  if (!b.useRecommend && b.granted == null) {
    return NextResponse.json({ error: 'granted_or_useRecommend_required' }, { status: 400 });
  }

  /* 대상 워커 조회 */
  const baseScope = userScope(session);
  const extra = b.mode === 'role'
    ? { role: b.role ?? 'WORKER' }
    : b.mode === 'list'
      ? { id: { in: (b.workerIds ?? []).map((s) => BigInt(s)) } }
      : { role: 'WORKER' as const };
  const targets = await prisma.user.findMany({
    where: { ...baseScope, status: 'ACTIVE', ...extra },
    select: { id: true, name: true, employeeNo: true, hireDate: true },
  });

  let granted = 0, skipped = 0;
  const details: Array<{ id: string; name: string; days: number; action: 'created' | 'updated' | 'skipped'; reason?: string }> = [];

  for (const w of targets) {
    const days = b.useRecommend
      ? recommendedAnnualLeaveDays(w.hireDate).days
      : (b.granted ?? 0);
    if (days <= 0 && b.useRecommend) {
      details.push({ id: w.id.toString(), name: w.name, days: 0, action: 'skipped', reason: '권장 0일 (입사일 미등록 또는 1년 미만 만근 0)' });
      skipped++;
      continue;
    }
    const existing = await prisma.annualLeaveBalance.findUnique({
      where: { workerId_year: { workerId: w.id, year: b.year } },
    });
    if (existing && !b.overwrite) {
      details.push({ id: w.id.toString(), name: w.name, days, action: 'skipped', reason: '이미 부여 (overwrite=false)' });
      skipped++;
      continue;
    }
    await prisma.annualLeaveBalance.upsert({
      where: { workerId_year: { workerId: w.id, year: b.year } },
      create: {
        workerId: w.id,
        year: b.year,
        granted: days,
        carriedOver: b.carriedOver ?? 0,
        note: b.note ?? `[일괄부여] ${b.useRecommend ? '권장값' : `${days}일`}`,
      },
      update: {
        granted: days,
        carriedOver: b.carriedOver ?? 0,
        note: b.note ?? `[일괄갱신] ${days}일`,
      },
    });
    details.push({ id: w.id.toString(), name: w.name, days, action: existing ? 'updated' : 'created' });
    granted++;
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LEAVE_BALANCE_BULK_GRANT',
      resourceType: 'user',
      resourceId: '*',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        year: b.year, mode: b.mode, useRecommend: b.useRecommend ?? false,
        granted, skipped, total: targets.length,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, year: b.year, granted, skipped, total: targets.length, details });
}
