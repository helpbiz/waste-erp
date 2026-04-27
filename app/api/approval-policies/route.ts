/**
 * GET  /api/approval-policies — 가시범위 정책 목록
 * POST /api/approval-policies — 정책 등록/수정 (upsert by contractor+resourceType+stage)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { invalidatePolicyCache } from '@/lib/approval-policy';

export const runtime = 'nodejs';

const Body = z.object({
  contractorId: z.string().optional(),
  resourceType: z.string().min(1).max(30),
  stage: z.number().int().min(1).max(2),
  positionCodes: z.array(z.string().max(20)).max(20),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const where: Prisma.ApprovalPolicyWhereInput = { active: true };
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ items: [] });
    where.contractorId = BigInt(session.contractorId);
  }

  const items = await prisma.approvalPolicy.findMany({
    where,
    orderBy: [{ contractorId: 'asc' }, { resourceType: 'asc' }, { stage: 'asc' }],
  });
  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id.toString(),
      contractorId: p.contractorId.toString(),
      resourceType: p.resourceType,
      stage: p.stage,
      positionCodes: p.positionCodes.split(',').filter(Boolean),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const contractorId = session.role === 'SUPER_ADMIN' && b.contractorId
    ? BigInt(b.contractorId)
    : (session.contractorId ? BigInt(session.contractorId) : null);
  if (!contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 403 });

  /* upsert: 활성 동일 키 비활성화 후 신규 (이력 유지) */
  await prisma.approvalPolicy.updateMany({
    where: { contractorId, resourceType: b.resourceType, stage: b.stage, active: true },
    data: { active: false },
  });
  const created = await prisma.approvalPolicy.create({
    data: {
      contractorId,
      resourceType: b.resourceType,
      stage: b.stage,
      positionCodes: b.positionCodes.join(','),
      createdBy: BigInt(session.userId),
    },
  });
  invalidatePolicyCache();

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'APPROVAL_POLICY_SET',
      resourceType: 'approval_policy',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        resourceType: b.resourceType,
        stage: b.stage,
        positionCodes: b.positionCodes,
      } as object,
    },
  });
  return NextResponse.json({ ok: true, id: created.id.toString() });
}
