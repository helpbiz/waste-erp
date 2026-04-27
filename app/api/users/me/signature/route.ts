/**
 * GET /api/users/me/signature — 본인 active 서명 (결재 모달 자동 노출용)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    include: { activeSignature: { include: { asset: true } } },
  });
  if (!u || !u.activeSignature) {
    return NextResponse.json({ signatureUrl: null, signatureRef: null });
  }
  return NextResponse.json({
    signatureUrl: u.activeSignature.asset.contentRef,
    signatureRef: u.activeSignature.signatureRef,
  });
}
