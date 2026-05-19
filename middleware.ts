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
  '/api/auth/noc-issue',  /* NOC 무인 단말 long-lived JWT 발급 — Bearer 시크릿 별도 검증 */
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
 *  - 개인정보 동의 (POST /api/auth/consent) — 최초 로그인 시 필수, 동의 안 하면 어떤 페이지도 접근 불가
 *  - 비밀번호 변경 (PATCH /api/users/me/password) — 본인 계정 보안
 *  - 본인 프로필 사진/서명 (PATCH/POST /api/users/me/...) — 본인 데이터 한정
 */
function isReadOnlyExempt(method: string, path: string): boolean {
  if (method === 'POST' && path === '/api/complaints') return true;       // 민원 입력
  if (method === 'POST' && path === '/api/auth/logout') return true;      // 로그아웃
  if (method === 'POST' && path === '/api/auth/consent') return true;     // 동의 (사용자 진단 2026-04-29)
  if (path.startsWith('/api/users/me/')) return true;                     // 본인 계정 관리 (PW/사진/서명)
  /* 공지사항 — MUNI_ADMIN 도 작성/수정/삭제 허용 (사용자 요구사항 2026-05-02).
     실제 audience 정책은 API 핸들러에서 강제 (lib/announcement-audience). */
  if (path === '/api/announcements' && (method === 'POST')) return true;
  if (path.startsWith('/api/announcements/') && (method === 'PATCH' || method === 'DELETE')) return true;
  return false;
}

function isPublic(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith('/_next/')) return true;
  if (path === '/favicon.ico') return true;
  /* 서비스 소개서 — 영업·홍보용 공개 페이지 */
  if (path === '/intro' || path.startsWith('/intro/')) return true;
  /* 사용자 매뉴얼 — 도입 후 사용자 학습용 공개 페이지 */
  if (path === '/manual' || path.startsWith('/manual/')) return true;
  /* 시민 민원앱 — 인증 불필요 (전화번호 기반 식별) */
  if (path === '/citizen' || path.startsWith('/citizen/')) return true;
  if (path.startsWith('/api/citizen/')) return true;
  /* Cron 엔드포인트 — Bearer 토큰 별도 검증 */
  if (path.startsWith('/api/cron/')) return true;
  /* PWA 정적 자산 — 인증 불필요 */
  if (path === '/manifest.json' || path === '/sw.js') return true;
  if (path.startsWith('/icons/')) return true;
  /* 브랜드 자산 (로고 등) — 로그인 페이지에서 표시되어야 하므로 인증 불필요 (사용자 진단 2026-04-29) */
  if (path.startsWith('/brand/')) return true;
  /* Let's Encrypt HTTP-01 ACME challenge — 인증 불필요 */
  if (path.startsWith('/.well-known/acme-challenge/')) return true;
  /* 기능 비활성 안내 페이지 — 게이트에서 redirect 받을 때 인증 흐름 끊지 않도록 public */
  if (path === '/feature-disabled') return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* Let's Encrypt HTTP-01 ACME challenge — middleware에서 직접 응답
     라우터가 wci.helpbiz.kr → cleanerp-app:3001 직접 포워딩하므로 nginx 거치지 않음.
     ACME_CHALLENGES env JSON으로 토큰→응답 매핑.
     예: ACME_CHALLENGES='{"abc123":"abc123.xyz789"}' */
  if (pathname.startsWith('/.well-known/acme-challenge/')) {
    const token = pathname.slice('/.well-known/acme-challenge/'.length);
    /* thumbprint 기반 동적 응답 — 어떤 토큰에도 <token>.<thumbprint> 로 응답 */
    const thumbprint = process.env.ACME_THUMBPRINT;
    if (thumbprint && token) {
      return new NextResponse(`${token}.${thumbprint}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    /* 레거시: 단일 토큰 */
    const single = process.env.ACME_CHALLENGE_TOKEN;
    const singleResp = process.env.ACME_CHALLENGE_RESPONSE;
    if (single && singleResp && single === token) {
      return new NextResponse(singleResp, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    /* 레거시: JSON 멀티맵 */
    const multiRaw = process.env.ACME_CHALLENGES;
    if (multiRaw) {
      try {
        const map = JSON.parse(multiRaw) as Record<string, string>;
        if (map[token]) {
          return new NextResponse(map[token], {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      } catch {
        /* invalid JSON */
      }
    }
    return new NextResponse('token_not_configured', { status: 404 });
  }

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
