/**
 * POST /api/users/[id]/signature — 서명 자가 등록
 * 본인 또는 가시범위 관리자만 가능.
 * Design Ref: §4 (FR-14), §2.1 D3
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers } from '@/lib/users';
import { registerUserSignature } from '@/lib/signatures';

export const runtime = 'nodejs';

const Body = z.object({ signature: z.string().max(280_000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const isSelf = id.toString() === session.userId;
  if (!isSelf) {
    if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const target = await prisma.user.findFirst({ where: { id, ...userScope(session) }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const reg = await registerUserSignature({
    userId: id,
    dataUrl: parsed.data.signature,
    createdBy: BigInt(session.userId),
  });
  if ('error' in reg) return NextResponse.json({ error: reg.error }, { status: 400 });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'USER_SIGNATURE_REGISTER',
      resourceType: 'user',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { signatureRef: reg.signatureRef, isSelf } as object,
    },
  });

  return NextResponse.json({ ok: true, signatureId: reg.id.toString(), signatureRef: reg.signatureRef });
}
