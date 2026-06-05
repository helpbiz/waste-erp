/**
 * GET  /api/departments — 가시범위 부서 목록
 * POST /api/departments — 신규 부서 (관리자만)
 * Design Ref: §4
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

const Create = z.object({
  contractorId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  excludeFromTbm: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const reqContractorId = url.searchParams.get('contractorId');

  const where: Prisma.DepartmentWhereInput = { active: true };
  if (session.role === 'SUPER_ADMIN') {
    if (reqContractorId) where.contractorId = BigInt(reqContractorId);
  } else if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ departments: [] });
    where.contractorId = BigInt(session.contractorId);
  } else if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ departments: [] });
    where.contractor = { municipalityId: BigInt(session.municipalityId) };
  } else {
    return NextResponse.json({ departments: [] });
  }

  const items = await prisma.department.findMany({
    where,
    include: { head: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({
    departments: items.map((d) => ({
      id: d.id.toString(),
      contractorId: d.contractorId.toString(),
      parentId: d.parentId?.toString() ?? null,
      name: d.name,
      sortOrder: d.sortOrder,
      excludeFromTbm: d.excludeFromTbm,
      headUserId: d.headUserId?.toString() ?? null,
      headUserName: d.head?.name ?? null,
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

  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN') {
    if (!b.contractorId) return NextResponse.json({ error: 'contractorId_required' }, { status: 400 });
    contractorId = BigInt(b.contractorId);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
    contractorId = BigInt(session.contractorId);
  }

  /* parentId 검증 */
  let parentId: bigint | null = null;
  if (b.parentId) {
    parentId = BigInt(b.parentId);
    const parent = await prisma.department.findFirst({ where: { id: parentId, contractorId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: 'parent_not_found' }, { status: 404 });
  }

  const created = await prisma.department.create({
    data: {
      contractorId,
      parentId,
      name: b.name,
      sortOrder: b.sortOrder ?? 0,
      excludeFromTbm: b.excludeFromTbm ?? false,
    },
  });
  return NextResponse.json({ ok: true, id: created.id.toString() }, { status: 201 });
}
