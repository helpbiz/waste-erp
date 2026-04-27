/**
 * GET  /api/delegations — 가시범위 내 활성 위임 규칙 목록
 * POST /api/delegations — 신규 위임 규칙
 *
 * 권한: SUPER / CONTRACTOR_ADMIN / INTERNAL_ADMIN
 *  - 자신을 위임자(delegator)로 또는 자신의 위탁업체 사용자 간 위임만 등록 가능 (소속 검증)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers, userScope } from '@/lib/users';

export const runtime = 'nodejs';

const Create = z.object({
  delegatorId: z.string(),
  delegateId: z.string(),
  resourceType: z.enum(['leave_request', 'leave_balance', 'user_create', 'user_disable', '*']),
  reason: z.string().max(255).optional(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const where: Prisma.DelegationRuleWhereInput = { active: true };
  if (session.role !== 'SUPER_ADMIN') {
    where.delegator = userScope(session);
  }

  const items = await prisma.delegationRule.findMany({
    where,
    include: {
      delegator: { select: { id: true, name: true, employeeNo: true } },
      delegate: { select: { id: true, name: true, employeeNo: true } },
    },
    orderBy: { startsAt: 'desc' },
  });

  return NextResponse.json({
    items: items.map((d) => ({
      id: d.id.toString(),
      delegatorId: d.delegatorId.toString(),
      delegatorName: d.delegator.name,
      delegateId: d.delegateId.toString(),
      delegateName: d.delegate.name,
      resourceType: d.resourceType,
      reason: d.reason,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt.toISOString(),
      active: d.active,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  if (b.delegatorId === b.delegateId) {
    return NextResponse.json({ error: 'cannot_self_delegate' }, { status: 400 });
  }

  /* 두 사용자 모두 가시범위 내 */
  const [delegator, delegate] = await Promise.all([
    prisma.user.findFirst({ where: { id: BigInt(b.delegatorId), ...userScope(session) }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: BigInt(b.delegateId), ...userScope(session) }, select: { id: true } }),
  ]);
  if (!delegator || !delegate) {
    return NextResponse.json({ error: 'out_of_scope' }, { status: 403 });
  }

  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(b.endsAt);
  if (endsAt.getTime() < startsAt.getTime()) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
  }

  /* 동일 (delegator, resourceType) 활성 규칙 비활성화 (단일 활성 보장) */
  await prisma.delegationRule.updateMany({
    where: {
      delegatorId: BigInt(b.delegatorId),
      resourceType: b.resourceType,
      active: true,
    },
    data: { active: false },
  });

  const created = await prisma.delegationRule.create({
    data: {
      delegatorId: BigInt(b.delegatorId),
      delegateId: BigInt(b.delegateId),
      resourceType: b.resourceType,
      reason: b.reason ?? null,
      startsAt,
      endsAt,
      createdBy: BigInt(session.userId),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'DELEGATION_CREATE',
      resourceType: 'delegation',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        delegatorId: b.delegatorId,
        delegateId: b.delegateId,
        resourceType: b.resourceType,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() }, { status: 201 });
}
