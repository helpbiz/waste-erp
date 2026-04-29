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
      if (data?.needsConsent) {
        router.replace(`/consent?next=${encodeURIComponent(finalTarget)}`);
      } else {
        router.replace(finalTarget);
      }
      router.refresh();
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
      <div className="absolute inset-0 flex items-center justify-center px-[12px] overflow-y-auto overflow-x-hidden py-[12px]">
       {/* 사용자 요청 2026-04-29 v8: 로그인 화면 한정 절대 px 스코프.
           — 앱 전역 root font-size: 36px 의 영향을 받지 않도록 모든 사이즈를 px 단위로 고정.
           — 로고 + 카드 합산 높이가 작은 폰(360x740) 뷰포트에 완전히 들어오도록 컴팩트화. */}
       <div className="w-full" style={{ maxWidth: 'min(92vw, 440px)' }}>
        {/* 🔒 LOGO LOCK — src/alt 보존. 폭 컴팩트화 (m(60vw, 280px)) — 작은 폰에서 한 화면에 다 보이도록. */}
        <div className="flex justify-center" style={{ marginBottom: '14px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal-dark.svg"
            alt="공비랩 Clean ERP"
            className="block h-auto drop-shadow-lg"
            style={{ width: 'min(60vw, 280px)' }}
          />
        </div>

        {/* 카드 — 절대 px 사이즈, root font 36px 영향 차단 */}
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          style={{ padding: '16px', fontSize: '15px' }}
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            spellCheck={false}
            placeholder="아이디"
            className="w-full rounded-lg border-2 border-slate-200 font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition"
            style={{ padding: '11px 13px', fontSize: '15px', marginBottom: '10px' }}
          />

          <div className="relative" style={{ marginBottom: '10px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호"
              className="w-full rounded-lg border-2 border-slate-200 font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition"
              style={{ padding: '11px 40px 11px 13px', fontSize: '15px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              className="absolute inset-y-0 right-0 flex items-center text-slate-500 hover:text-accent"
              style={{ padding: '0 12px' }}
            >
              {showPassword ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L14.12 14.12m0 0L21 21m-6.88-6.88a3 3 0 01-4.242-4.242" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* 아이디 기억하기 체크박스 */}
          <label
            className="flex items-center cursor-pointer select-none"
            style={{ gap: '8px', marginTop: '2px', marginBottom: '2px' }}
          >
            <input
              type="checkbox"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
              className="accent-accent cursor-pointer"
              style={{ width: '16px', height: '16px' }}
            />
            <span className="font-semibold text-slate-700" style={{ fontSize: '13px' }}>
              아이디 기억하기
            </span>
          </label>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg bg-red-50 border border-red-200 font-bold text-red-700"
              style={{ marginTop: '8px', padding: '8px 12px', fontSize: '13px' }}
            >
              {error}
            </div>
          )}

          {/* 로그인 CTA — 절대 px 사이즈 */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-lg bg-accent text-white font-extrabold tracking-wide hover:bg-cyan-800 active:bg-cyan-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ marginTop: '12px', minHeight: '46px', padding: '11px 16px', fontSize: '16px' }}
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>

          {/* 앱 설치 (보조) — 박스 테두리 없음 */}
          {installed ? (
            <div
              className="text-center font-bold text-emerald-700"
              style={{ marginTop: '8px', fontSize: '13px' }}
            >
              ✓ 앱 설치됨
            </div>
          ) : (
            <button
              type="button"
              onClick={installApp}
              className="w-full text-ink-mid font-bold hover:text-accent active:text-cyan-800 transition-colors"
              style={{ marginTop: '6px', minHeight: '34px', padding: '6px', fontSize: '13px' }}
            >
              앱으로 설치하기
            </button>
          )}
        </form>

        {/* 푸터 */}
        <div
          className="text-center font-semibold text-white/85"
          style={{ marginTop: '10px', fontSize: '11px' }}
        >
          © 공비랩 GONGBI LAB
        </div>
       </div>
      </div>
    </main>
  );
}
