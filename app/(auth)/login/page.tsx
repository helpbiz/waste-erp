'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
      // 모바일 + admin role 사용자는 모바일 검증된 /dashboard로 redirect (데스크톱은 기존 유지)
      const ADMIN_ROLES = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'];
      const isMobile = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 767px)').matches;
      const role = data?.user?.role as string | undefined;
      const mobileAdminTarget = isMobile && role && ADMIN_ROLES.includes(role)
        ? '/dashboard'
        : null;
      const finalTarget = explicitNext ?? mobileAdminTarget ?? data?.redirectTo ?? '/complaints';
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
      /* position fixed + inset 0 — 모바일 주소바·키보드 변동에 viewport 고정.
         overflow-y auto — 키보드로 콘텐츠 squish 시 inner scroll (background 는 정지).
         overscroll-contain + touch-action manipulation — bounce/zoom 비활성. */
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(circle at 20% 0%, #0e7490 0%, #164e63 45%, #0f172a 100%)',
        touchAction: 'manipulation',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div className="min-h-full w-full flex items-center justify-center px-4 py-4">
       <div className="w-full max-w-[400px]">
        {/* 로고 — 모바일에서 컴팩트 */}
        <div className="flex justify-center mb-4 sm:mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal-dark.svg"
            alt="공비랩 Clean ERP"
            className="block w-[200px] sm:w-[300px] h-auto drop-shadow-lg"
          />
        </div>

        {/* 카드 */}
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-5 sm:p-8"
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            spellCheck={false}
            placeholder="아이디"
            /* font-size 16px 이상 — iOS Safari focus 시 zoom 방지 */
            className="w-full px-4 py-3 rounded-lg border border-slate-200 text-base font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition mb-3"
          />

          <div className="relative mb-2">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호"
              /* font-size 16px 이상 — iOS Safari focus 시 zoom 방지 */
              className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 text-base font-semibold text-slate-900 bg-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 hover:text-accent"
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

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] font-bold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full mt-5 py-3 rounded-lg bg-accent text-white font-extrabold text-[15px] tracking-wide hover:bg-cyan-800 active:bg-cyan-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>

          {/* PWA 앱 설치 (보조 액션) */}
          <button
            type="button"
            onClick={installApp}
            disabled={installed}
            className="w-full mt-2.5 py-3 rounded-lg bg-white border-2 border-slate-200 text-slate-700 font-bold text-[14px] hover:border-accent hover:text-accent transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {installed ? '✓ 앱 설치됨' : '앱으로 설치하기'}
          </button>
        </form>

        {/* 푸터 — 모바일에서 컴팩트 */}
        <div className="text-center mt-3 sm:mt-6 text-[10px] sm:text-[11px] font-semibold text-white/50">
          © 공비랩 GONGBI LAB
        </div>
       </div>
      </div>
    </main>
  );
}
