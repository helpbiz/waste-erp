/**
 * P2-1: SUPER_ADMIN 사용자 임시 PW 강제 재설정.
 * 12자 랜덤 PW 생성 + 응답에 1회 노출 (재조회 불가).
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, contractorId: true, municipalityId: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const newPw = genPassword();
  const hash = await hashPassword(newPw);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: hash,
      lockedUntil: null,
      failedLoginAttempts: 0,
    },
  });

  await writeAudit(req, session, {
    action: 'USER_PW_RESET',
    resourceType: 'user',
    resourceId: id.toString(),
    contractorId: target.contractorId,
    municipalityId: target.municipalityId,
    metadata: { username: target.username, crossTenant: true },
  });

  return NextResponse.json({ ok: true, tempPassword: newPw });
}
