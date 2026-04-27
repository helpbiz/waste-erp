/**
 * Next.js Edge 미들웨어 — 라우트 진입 시점 1차 방어
 * - /login, /api/auth/login, /api/health 는 공개
 * - 그 외는 JWT 쿠키 필수
 * - MUNI_ADMIN의 mutate 메서드(POST/PUT/PATCH/DELETE)는 즉시 403 (Plan §7-3)
 *
 * Edge에서는 Prisma를 사용하지 않으므로 토큰 검증만 수행한다.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/* deploy-readiness P0-1: fallback 제거. middleware는 edge runtime — throw 시 모든 요청 500.
   prod 환경 변수 미설정 = 즉각 실패가 의도된 안전장치. */
const RAW_SECRET = process.env.JWT_SECRET;
if (!RAW_SECRET || RAW_SECRET.length < 32) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았거나 32자 미만입니다.');
}
const SECRET = new TextEncoder().encode(RAW_SECRET);

const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/auth/login',
  '/api/health',
  '/reset',  /* 캐시 초기화 페이지 — 로그인 불필요 */
]);

/* 미동의 사용자에게도 허용되는 경로 — /consent 페이지 자체 + 동의/로그아웃 API */
const CONSENT_EXEMPT_PATHS = new Set<string>([
  '/consent',
  '/api/auth/consent',
  '/api/auth/logout',
  '/api/auth/me',
]);

const READ_ONLY_ROLES = new Set<string>(['MUNI_ADMIN']);
const MUTATING_METHODS = new Set<string>(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * READ_ONLY_ROLES의 mutate 화이트리스트.
 * MUNI_ADMIN은 원칙적으로 GET-only이지만 일부 정당한 입력은 허용:
 *  - 민원 입력 (POST /api/complaints) — 시민 대신 입력
 *  - 로그아웃 (POST /api/auth/logout)
 */
function isReadOnlyExempt(method: string, path: string): boolean {
  if (method === 'POST' && path === '/api/complaints') return true;       // 민원 입력
  if (method === 'POST' && path === '/api/auth/logout') return true;      // 로그아웃
  return false;
}

function isPublic(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith('/_next/')) return true;
  if (path === '/favicon.ico') return true;
  /* 시민 민원앱 — 인증 불필요 (전화번호 기반 식별) */
  if (path === '/citizen' || path.startsWith('/citizen/')) return true;
  if (path.startsWith('/api/citizen/')) return true;
  /* Cron 엔드포인트 — Bearer 토큰 별도 검증 */
  if (path.startsWith('/api/cron/')) return true;
  /* PWA 정적 자산 — 인증 불필요 */
  if (path === '/manifest.json' || path === '/sw.js') return true;
  if (path.startsWith('/icons/')) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get('wciSession')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  let role: string | undefined;
  let consentedAt: string | null = null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    role = payload.role as string | undefined;
    consentedAt = (payload.consentedAt as string | null | undefined) ?? null;
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  /* 개인정보 동의 미진행 사용자 차단 — /consent 외 모든 경로 차단 */
  if (!consentedAt && !CONSENT_EXEMPT_PATHS.has(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'consent_required' }, { status: 403 });
    }
    const url = new URL('/consent', req.url);
    if (pathname !== '/' && pathname !== '/dashboard') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  /* MUNI_ADMIN GET-only 강제 (Plan §7-3) — 화이트리스트 예외 */
  if (
    pathname.startsWith('/api/') &&
    MUTATING_METHODS.has(req.method) &&
    role &&
    READ_ONLY_ROLES.has(role) &&
    !isReadOnlyExempt(req.method, pathname)
  ) {
    return NextResponse.json(
      { error: 'forbidden', reason: 'read_only_role', role },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
