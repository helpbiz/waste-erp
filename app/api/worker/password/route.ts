/**
 * POST /api/worker/password — 본인 비밀번호 변경
 * 현재 비밀번호를 검증한 후 새 비밀번호로 교체.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, '새 비밀번호는 6자 이상이어야 합니다').max(100),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const id = BigInt(session.userId);
  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'incorrect_password' }, { status: 400 });

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await prisma.auditLog.create({
    data: {
      actorId: id,
      actorRole: session.role,
      action: 'USER_SELF_PASSWORD_CHANGE',
      resourceType: 'user',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });

  return NextResponse.json({ ok: true });
}
