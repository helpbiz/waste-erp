'use client';

/**
 * AdminShell — 반응형 관리자 레이아웃
 * - md+ (≥768px): 사이드바 항상 노출
 * - mobile (<768px): 햄버거 메뉴 + 슬라이드 드로어
 * - 라우트 이동 시 드로어 자동 닫힘
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from './_logout-button';
/* 글로벌 알림(AnnouncementBanner + ComplaintBanner)은 root layout 으로 이관됨.
   사용자 요청 2026-05-02: shell 외부 화면에서도 자동 팝업 노출되도록. */

type Session = {
  role: string;
  name: string;
};

type NavItemDef = {
  href: string;
  label: string;
  badge?: string;
  /** 새 탭 열기 (도움말·외부 등) */
  newTab?: boolean;
};

type NavGroup = {
  group: string;
  items: NavItemDef[];
};

export default function AdminShell({
  session,
  groups,
  pageTitle,
  canMutate,
  children,
}: {
  session: Session;
  groups: NavGroup[];
  pageTitle: string;
  canMutate: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  /* 활성 메뉴의 라벨로 헤더 타이틀 자동 보정 */
  const activeTitle =
    groups.flatMap((g) => g.items)
      .find((it) => pathname === it.href || pathname.startsWith(it.href + '/'))
      ?.label ?? pageTitle;

  /* 라우트 변경 시 드로어 자동 닫기 */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* 드로어 열림 시 body 스크롤 잠금 */
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* 드로어 열림 시 Escape 키로 닫기 (WCAG 2.1.2 키보드 트랩 회피) */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  /* 사용자 요청 2026-04-29: 모든 viewport 에서 햄버거 + 드로어 패턴 고정.
     이전: md+ 사이드바 자동 노출. 변경: 사이드바는 드로어로만, 햄버거 항상 표시.
     PWA 설치 후 전체화면 desktop 모드에서도 일관된 모바일-퍼스트 UX. */
  return (
    <div className="min-h-screen flex">
      {/* 드로어 (모든 viewport — 클릭 시에만 노출) */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/55"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <SidebarBody
            session={session}
            groups={groups}
            pathname={pathname}
            className="fixed top-0 left-0 bottom-0 z-50 w-[280px] animate-slide-in"
          />
        </>
      )}

      {/* 본문 */}
      <main className="flex-1 flex flex-col bg-page min-w-0">
        <header className="h-16 bg-surface border-b-2 border-line flex items-center px-4 sm:px-6 gap-3 shadow-sm">
          {/* 햄버거 (모든 viewport — 사이즈 키움) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="p-2 -ml-2 rounded-md hover:bg-surface-soft active:scale-95"
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 헤더 타이틀 — 폰트 한 단계 업 (text-lg → text-xl) */}
          <h1 className="text-lg sm:text-xl font-extrabold text-ink flex-1 tracking-tight truncate">{activeTitle}</h1>

          {!canMutate && (
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-sm font-mono font-extrabold bg-red-100 text-red-800 border border-red-300">
              READ-ONLY
            </span>
          )}
          <NowStamp className="hidden lg:inline-block" />
          <span className="hidden lg:flex items-center gap-1.5 text-sm font-mono font-extrabold text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_0_3px_rgba(22,163,74,0.18)]" />
            시스템 정상
          </span>
          {/* 헤더 우측 끝 로그아웃 */}
          <LogoutButton theme="light" />
        </header>
        {/* 글로벌 알림은 app/layout.tsx GlobalNotifications 으로 이관 — 모든 화면 공통 */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</section>
      </main>
    </div>
  );
}

function SidebarBody({
  session,
  groups,
  pathname,
  className = '',
}: {
  session: Session;
  groups: NavGroup[];
  pathname: string;
  className?: string;
}) {
  return (
    <aside className={`bg-sidebar text-slate-200 flex flex-col ${className}`}>
      <div className="px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-horizontal-dark.svg"
          alt="공비랩 Clean ERP"
          width={200}
          height={85}
          className="block w-[200px] h-auto"
        />
      </div>

      <nav className="flex-1 py-3 text-sm overflow-y-auto">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-5 pt-4 pb-1.5 text-[0.6875rem] font-mono font-semibold text-slate-300/70 tracking-widest first:pt-2">
              {g.group}
            </div>
            {g.items.map((it) => {
              const active = !it.newTab && (pathname === it.href || pathname.startsWith(it.href + '/'));
              const linkProps = it.newTab ? { target: '_blank', rel: 'noopener' } : {};
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  {...linkProps}
                  className={`flex items-center gap-2.5 px-5 py-3 md:py-2.5 border-l-[3px] text-sm transition-colors ${
                    active
                      ? 'text-cyan-300 font-bold bg-cyan-500/15 border-l-cyan-400'
                      : 'text-slate-200 hover:bg-white/5 hover:text-white border-l-transparent'
                  }`}
                >
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.badge && (
                    <span className="text-[0.6875rem] font-mono font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white">
                      {it.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 사이드바 footer — 클릭 시 /profile(비밀번호 변경) 이동 */}
      <Link
        href="/profile"
        className="px-4 py-4 border-t border-white/10 bg-black/15 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-extrabold shadow-card flex-shrink-0">
          {session.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-extrabold truncate">{session.name}</div>
          <div className="text-slate-300 text-sm font-mono font-bold mt-0.5">{session.role}</div>
        </div>
      </Link>
    </aside>
  );
}

function NowStamp({ className = '' }: { className?: string }) {
  const [stamp, setStamp] = useState<string>('');
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const pad = (n: number) => String(n).padStart(2, '0');
      setStamp(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${days[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className={`font-mono text-sm font-bold text-ink ${className}`}>{stamp}</span>;
}
