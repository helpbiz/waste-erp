/**
 * POST /api/bulky-waste/import — 수동 자동반영 트리거
 *  body: { mode?: 'import' | 'resolve' | 'both' }  (기본 'import')
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { runBulkyImport, runBulkyResolve } from '@/lib/bulky-waste';

export const runtime = 'nodejs';

const Body = z.object({ mode: z.enum(['import', 'resolve', 'both']).optional() });

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const mode = parsed.success ? parsed.data.mode ?? 'import' : 'import';

  const config = await prisma.bulkyWasteConfig.findUnique({
    where: { contractorId: BigInt(session.contractorId) },
  });
  if (!config) return NextResponse.json({ error: 'config_not_found', hint: '먼저 빼기 인증 정보를 등록하세요.' }, { status: 404 });

  const out: { import?: unknown; resolve?: unknown } = {};
  if (mode === 'import' || mode === 'both') {
    out.import = await runBulkyImport(config.id, BigInt(session.userId), 'manual');
  }
  if (mode === 'resolve' || mode === 'both') {
    out.resolve = await runBulkyResolve(config.id, BigInt(session.userId), 'manual');
  }

  return NextResponse.json({ ok: true, ...out });
}
