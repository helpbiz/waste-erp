/**
 * GET  /api/muni-users — 본인 지자체 소속 지자체사용자(MUNI_USER) 목록
 * POST /api/muni-users — 지자체사용자 계정 신규 생성
 *
 * muni-user-delegation 2026-08-15 — MUNI_ADMIN 전용. 기존 /api/users(위탁업체 직원 대상,
 * canManageUsers)와 분리된 전용 경로. 절대 위반 금지 제약(2026-08-15 보안검토):
 *  - 생성 가능 role은 MUNI_USER 하나로 하드코딩 (body의 role 필드를 받지 않음 — 상위 role 승격 차단)
 *  - municipalityId는 세션값 강제, contractorId는 항상 null 강제
 *  - 조회·검증 스코프는 lib/users.ts manageableUserScope() 하나로만 수행 (userScope 재사용 금지)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { readSession, hashPassword } from '@/lib/auth';
import { manageableUserScope } from '@/lib/users';

export const runtime = 'nodejs';

const Create = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.@-]+$/),
  password: z.string().min(6).max(100).optional(),
  name: z.string().trim().min(1).max(50),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).optional().nullable(),
});

function randomTempPassword(): string {
  return randomBytes(9).toString('base64url'); // 12자 내외, URL-safe
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const items = await prisma.user.findMany({
    where: manageableUserScope(session),
    orderBy: { name: 'asc' },
    select: { id: true, username: true, name: true, phone: true, status: true, lastLogin: true, createdAt: true },
  });

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      name: u.name,
      phone: u.phone,
      status: u.status,
      lastLogin: u.lastLogin?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.municipalityId) return NextResponse.json({ error: 'no_municipality_scope' }, { status: 403 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const dup = await prisma.user.findUnique({ where: { username: b.username } });
  if (dup) return NextResponse.json({ error: 'username_taken' }, { status: 409 });

  const generatedPassword = b.password ? undefined : randomTempPassword();
  const passwordHash = await hashPassword(b.password ?? generatedPassword!);

  const created = await prisma.user.create({
    data: {
      username: b.username,
      passwordHash,
      name: b.name,
      role: 'MUNI_USER',
      municipalityId: BigInt(session.municipalityId),
      contractorId: null,
      phone: b.phone ? b.phone.replace(/-/g, '') : null,
      status: 'ACTIVE',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      municipalityId: BigInt(session.municipalityId),
      action: 'MUNI_USER_CREATE',
      resourceType: 'user',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });

  return NextResponse.json(
    { ok: true, id: created.id.toString(), generatedPassword },
    { status: 201 }
  );
}
