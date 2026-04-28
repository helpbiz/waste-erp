/**
 * GET /api/positions — 활성 직책 마스터 목록 (캐시)
 * POST /api/positions — 신규 직책 등록 (canManageUsers).
 *   사용자 요청 2026-04-29: 회사 관리자가 조직도 셋업 시 직책 추가 가능.
 *   ⚠ Position 은 전역 모델 — 모든 회사 공유.
 * Design Ref: §4
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { listActivePositions } from '@/lib/positions';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Create = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]+$/, 'code 는 대문자 영문/숫자/_ 만').min(2).max(20),
  label: z.string().trim().min(1).max(40),
  category: z.enum(['OFFICE', 'FIELD', 'OTHER']),
  sortOrder: z.number().int().min(0).max(9999).default(900),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const positions = await listActivePositions();
  return NextResponse.json({
    positions: positions.map((p) => ({
      id: p.id.toString(),
      code: p.code,
      label: p.label,
      category: p.category,
      sortOrder: p.sortOrder,
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

  /* code 중복 검사 */
  const existing = await prisma.position.findUnique({ where: { code: b.code } });
  if (existing) {
    return NextResponse.json({ error: 'duplicate_code', code: b.code }, { status: 409 });
  }

  const created = await prisma.position.create({
    data: { code: b.code, label: b.label, category: b.category, sortOrder: b.sortOrder, active: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'POSITION_CREATE',
      resourceType: 'position',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { code: b.code, label: b.label, category: b.category } as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({
    ok: true,
    position: {
      id: created.id.toString(), code: created.code, label: created.label,
      category: created.category, sortOrder: created.sortOrder,
    },
  });
}
