/**
 * POST /api/bulky-waste/test-login — 빼기 로그인 시뮬 (저장 X)
 *   body: { username, password }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { testLogin } from '@/lib/ppaegi';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const r = await testLogin(parsed.data);
  return NextResponse.json(r);
}
