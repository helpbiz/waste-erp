/**
 * POST /api/muni-users/[id]/password — 지자체사용자(MUNI_USER) 비밀번호 강제 재설정
 *
 * 본인 비밀번호 변경(현재 비밀번호 검증)과는 별개 경로. 관리자가 타인 비밀번호를
 * 강제로 바꾸는 것이라 현재 비밀번호 검증이 원천적으로 불가능하므로 분리한다
 * (2026-08-15 보안검토 — 같은 엔드포인트에 플래그로 분기 시 검증 우회 경로가 생김).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { readSession, hashPassword } from '@/lib/auth';
import { parseId } from '@/lib/ids';
import { manageableUserScope } from '@/lib/users';

export const runtime = 'nodejs';

const Body = z.object({
  newPassword: z.string().min(6).max(100).optional(),
});

function randomTempPassword(): string {
  return randomBytes(9).toString('base64url');
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  if (id === BigInt(session.userId)) {
    return NextResponse.json({ error: 'use_self_password_change' }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  /* 스코프 밖 대상은 존재 여부를 노출하지 않기 위해 403이 아닌 404 */
  const target = await prisma.user.findFirst({
    where: { id, ...manageableUserScope(session) },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const generatedPassword = parsed.data.newPassword ? undefined : randomTempPassword();
  const passwordHash = await hashPassword(parsed.data.newPassword ?? generatedPassword!);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      municipalityId: session.municipalityId ? BigInt(session.municipalityId) : null,
      action: 'MUNI_USER_PASSWORD_RESET',
      resourceType: 'user',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });

  return NextResponse.json({ ok: true, generatedPassword });
}
