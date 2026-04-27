import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession, clearSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readSession();
  if (session) {
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'LOGOUT',
        resourceType: 'session',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    });
  }
  clearSession();
  return NextResponse.json({ ok: true });
}
