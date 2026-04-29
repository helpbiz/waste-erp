/**
 * GET /api/users/check-username?username=foo
 *  - 신규 등록 전 username 중복 검사 + 대안 제안.
 *  - 권한: 인증된 SUPER_ADMIN / CONTRACTOR_ADMIN / INTERNAL_ADMIN (관리자 그룹).
 *  - 응답: { available: bool, suggestions: string[] }
 *    - available=true: 사용 가능, suggestions=[] (필요 없음)
 *    - available=false: 사용 중, suggestions 최대 5개
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ADMIN_ROLES.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const raw = (url.searchParams.get('username') ?? '').trim();
  if (!raw) return NextResponse.json({ error: 'invalid_request', reason: 'username 비어있음' }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(raw)) {
    return NextResponse.json({ available: false, reason: 'format', suggestions: [] });
  }

  const exists = await prisma.user.findUnique({ where: { username: raw }, select: { id: true } });
  if (!exists) return NextResponse.json({ available: true, suggestions: [] });

  /* 사용 중 — 최대 5개 대안 생성:
     - 뒤에 -2, -3, -4, -5 추가
     - -YY (현재 연도 끝 2자리)
     - 모두 중복이면 timestamp 기반 fallback */
  const yearTail = new Date().getFullYear().toString().slice(-2);
  const candidates = [
    `${raw}-2`, `${raw}-3`, `${raw}-4`, `${raw}-5`,
    `${raw}-${yearTail}`,
    `${raw}-${Math.floor(Math.random() * 900 + 100)}`,
  ].filter((s) => s.length <= 30);

  const taken = await prisma.user.findMany({
    where: { username: { in: candidates } },
    select: { username: true },
  });
  const takenSet = new Set(taken.map((t) => t.username));
  const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 5);

  return NextResponse.json({ available: false, suggestions });
}
