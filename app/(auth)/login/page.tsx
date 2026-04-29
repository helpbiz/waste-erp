'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveRoleRoute } from '@/lib/auth/role-route';

type BeforeInstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/70">로딩 중…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const explicitNext = params.get('next');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberId, setRememberId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  /* 사용자 요청 2026-04-29 #12: 로그인 성공 시 환영 오버레이 1.2s 노출 후 이동 */
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallEvt(e as BeforeInstallEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setInstallEvt(null); });
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /* 사용자 요청 2026-04-29: 아이디 기억하기 — localStorage 보존.
     비밀번호는 절대 저장 안 함 (보안). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('cleanerp:rememberedUsername');
    if (saved) {
      setUsername(saved);
      setRememberId(true);
    }
  }, []);

  /* 로그인 화면 마운트 시 body scroll 잠금 — 외부 컨텐츠 스크롤 차단으로 화면 고정 */
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  /* 사용자 요청 2026-04-29: 핀치 줌 / 더블탭 줌 / iOS gesture 모두 JS 레벨에서 차단.
     (최신 Android Chrome 은 viewport user-scalable=no 를 접근성 우선으로 무시하므로
      추가 layer 필요.) 마운트 시에만 등록, 언마운트 시 정확히 제거. */
  useEffect(() => {
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const blockGesture = (e: Event) => e.preventDefault();
    const blockDblTapZoom = (() => {
      let last = 0;
      return (e: TouchEvent) => {
        const now = Date.now();
        if (now - last < 300) e.preventDefault();
        last = now;
      };
    })();
    /* passive: false 필수 — iOS 에서 preventDefault 를 작동시키려면 명시 필요 */
    document.addEventListener('touchmove', blockMultiTouch, { passive: false });
    document.addEventListener('touchend', blockDblTapZoom, { passive: false });
    document.addEventListener('gesturestart', blockGesture);
    document.addEventListener('gesturechange', blockGesture);
    document.addEventListener('gestureend', blockGesture);
    return () => {
      document.removeEventListener('touchmove', blockMultiTouch);
      document.removeEventListener('touchend', blockDblTapZoom);
      document.removeEventListener('gesturestart', blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('gestureend', blockGesture);
    };
  }, []);

  async function installApp() {
    if (!installEvt) {
      alert(
        '브라우저에서 직접 설치하세요:\n' +
        '• 안드로이드 Chrome: 메뉴 → "앱 설치"\n' +
        '• iOS Safari: 공유 → "홈 화면에 추가"\n' +
        '• 데스크톱 Chrome/Edge: 주소창 우측 ⊕ 아이콘'
      );
      return;
    }
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setInstallEvt(null);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    /* 아이디 기억하기 — 체크 시 localStorage 저장 / 해제 시 삭제 */
    if (typeof window !== 'undefined') {
      if (rememberId) localStorage.setItem('cleanerp:rememberedUsername', username.trim());
      else localStorage.removeItem('cleanerp:rememberedUsername');
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error === 'invalid_credentials'
            ? '아이디 또는 비밀번호가 올바르지 않습니다.'
            : '로그인 중 오류가 발생했습니다.'
        );
        return;
      }
      /* role → route 결정은 lib/auth/role-route.ts 단일 소스 (P0-7).
         RAPID 분기는 worker 셸 내부 메뉴 데이터에서 처리 (P1). */
      const isMobile = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 767px)').matches;
      const finalTarget = resolveRoleRoute({
        role: data?.user?.role,
        redirectTo: data?.redirectTo,
        explicitNext,
        isMobile,
      });
      /* #12 환영 메시지 — 1.2s 표시 후 이동 (스플래시 효과) */
      const userName = data?.user?.name ?? '';
      setWelcomeName(userName);
      setTimeout(() => {
        if (data?.needsConsent) {
          router.replace(`/consent?next=${encodeURIComponent(finalTarget)}`);
        } else {
          router.replace(finalTarget);
        }
        router.refresh();
      }, 1200);
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      /* 완전 고정: position fixed + inset 0 + overflow hidden — 어떤 경우에도 움직임 없음.
         overscroll-behavior none — pull-to-refresh / bounce 차단.
         touch-action manipulation — pinch zoom/double tap zoom 차단. */
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(circle at 20% 0%, #0e7490 0%, #164e63 45%, #0f172a 100%)',
        /* touch-action: pan-y → 핀치 줌 + 더블탭 줌 모두 차단, 세로 스크롤만 허용 (input focus 시 키패드 등장) */
        touchAction: 'pan-y',
        overflow: 'hidden',
        overscrollBehavior: 'none',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center px-3 overflow-y-auto overflow-x-hidden py-3">
       {/* v10 (사용자 요청 12 항목 일괄 적용): 부제·아이콘·SSL뱃지·관리자안내·환영오버레이 추가. */}
       <div className="w-full" style={{ maxWidth: 'min(92vw, 26rem)' }}>
        {/* 🔒 LOGO LOCK — src/alt 보존. */}
        <div className="flex justify-center mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal-dark.svg"
            alt="공비랩 Clean ERP"
            className="block h-auto drop-shadow-lg"
            style={{ width: 'min(60vw, 16rem)' }}
          />
        </div>

        {/* #2 부제 — 타이틀 30~40% 크기, 회색톤(#888 대신 흰배경에 white/70). */}
        <p className="text-center text-[0.6875rem] font-semibold text-white/75 mb-3 leading-snug px-2">
          생활폐기물 수집·운반 업무지원 시스템
        </p>

        {/* 카드 */}
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-3.5"
          aria-label="로그인 폼"
        >
          {/* #3 #11 — 아이디 입력 + 사용자 아이콘 + 명시적 라벨 (sr-only) + X 버튼 */}
          <label htmlFor="login-username" className="sr-only">아이디</label>
          <div className="relative mb-2.5">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none" aria-hidden="true">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              spellCheck={false}
              placeholder="아이디"
              aria-label="아이디"
              className="w-full pl-10 pr-9 py-2.5 rounded-lg border-2 border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition"
            />
            {username && (
              <button
                type="button"
                onClick={() => setUsername('')}
                aria-label="아이디 지우기"
                tabIndex={-1}
                className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 hover:text-slate-700"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 비밀번호 입력 + 자물쇠 아이콘 + 눈 토글 */}
          <label htmlFor="login-password" className="sr-only">비밀번호</label>
          <div className="relative mb-2.5">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none" aria-hidden="true">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-2-.895-2-2zM5 11V7a7 7 0 0114 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
              </svg>
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호"
              aria-label="비밀번호"
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-500 hover:text-accent"
            >
              {showPassword ? (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L14.12 14.12m0 0L21 21m-6.88-6.88a3 3 0 01-4.242-4.242" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* #5 아이디 기억하기 + 공용 PC 안내 + 비밀번호는 저장 안 됨 명시 */}
          <div className="mt-1 mb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberId}
                onChange={(e) => setRememberId(e.target.checked)}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700">아이디 기억하기</span>
              <span className="text-[0.625rem] font-medium text-slate-500">(비밀번호는 저장하지 않음)</span>
            </label>
            <p className="text-[0.625rem] font-medium text-slate-500 ml-6 mt-0.5">
              ⚠ 공용 PC에서는 체크 해제하세요
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700"
            >
              {error}
            </div>
          )}

          {/* #4 로그인 CTA — 입체 그림자 + 호버/액티브 + 로딩 스피너 + 화살표 아이콘 */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full mt-3 py-2.5 rounded-lg bg-[#0E9F8E] text-white font-extrabold text-sm tracking-wide hover:bg-[#0c8a7c] active:bg-[#0a7569] active:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            style={{ boxShadow: '0 4px 12px rgba(14,159,142,0.35)' }}
          >
            {loading ? (
              <>
                {/* 로딩 스피너 */}
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>로그인 중…</span>
              </>
            ) : (
              <>
                <span>로그인</span>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          {/* #7 비밀번호 분실 시 안내 (B2B 시스템) */}
          <p className="text-center mt-2 text-[0.625rem] font-medium text-slate-500">
            비밀번호 분실 시 관리자에게 문의해 주세요
          </p>

          {/* 앱 설치 (보조) */}
          {installed ? (
            <div className="text-center mt-2 text-xs font-bold text-emerald-700">
              ✓ 앱 설치됨
            </div>
          ) : (
            <button
              type="button"
              onClick={installApp}
              className="w-full mt-1.5 py-1.5 text-ink-mid font-bold text-xs hover:text-accent active:text-cyan-800 transition-colors"
            >
              앱으로 설치하기
            </button>
          )}
        </form>

        {/* #1 SSL 뱃지 + #6 풀 카피라이트 + 버전 */}
        <div className="text-center mt-2.5 space-y-0.5">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-300/30 text-[0.625rem] font-bold text-emerald-200">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-2-.895-2-2zM5 11V7a7 7 0 0114 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
            </svg>
            <span>보안 접속 (SSL)</span>
          </div>
          <div className="text-[0.625rem] font-semibold text-white/85">
            © 2026 GongbI LAB., Ltd. All rights reserved.
          </div>
          <div className="text-[0.5625rem] font-mono text-white/55">v1.0.0</div>
        </div>
       </div>
      </div>

      {/* #12 환영 오버레이 — 로그인 성공 1.2s 후 자동 이동 */}
      {welcomeName !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #0e7490 0%, #164e63 60%, #0f172a 100%)',
          }}
          role="status"
          aria-live="polite"
        >
          <div className="text-center text-white px-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl mb-3">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-black mb-1 break-keep">환영합니다, {welcomeName}님</h2>
            <p className="text-xs font-semibold text-white/80">잠시만 기다려 주세요…</p>
          </div>
        </div>
      )}
    </main>
  );
}
