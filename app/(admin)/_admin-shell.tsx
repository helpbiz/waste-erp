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

type Session = {
  role: string;
  name: string;
};

type NavItemDef = {
  href: string;
  label: string;
  badge?: string;
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

  return (
    <div className="min-h-screen flex">
      {/* 사이드바 (md+ 항상 노출) */}
      <SidebarBody session={session} groups={groups} pathname={pathname} className="hidden md:flex w-[240px]" />

      {/* 모바일 드로어 */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/55 md:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <SidebarBody
            session={session}
            groups={groups}
            pathname={pathname}
            className="fixed top-0 left-0 bottom-0 z-50 w-[260px] md:hidden animate-slide-in"
          />
        </>
      )}

      {/* 본문 */}
      <main className="flex-1 flex flex-col bg-page min-w-0">
        <header className="h-14 bg-surface border-b-2 border-line flex items-center px-3 sm:px-5 md:px-7 gap-2 md:gap-3 shadow-sm">
          {/* 햄버거 (모바일 only) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="md:hidden p-2 -ml-2 rounded-md hover:bg-surface-soft active:scale-95"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-sm md:text-base font-extrabold text-ink flex-1 tracking-tight truncate">{activeTitle}</h1>

          {!canMutate && (
            <span className="hidden sm:inline-block px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-mono font-extrabold bg-red-100 text-red-700 border border-red-300">
              READ-ONLY
            </span>
          )}
          <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-mono font-extrabold bg-accent-soft text-accent border border-accent">
            {session.role}
          </span>
          <NowStamp className="hidden lg:inline-block" />
          <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono font-extrabold text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_0_3px_rgba(22,163,74,0.18)]" />
            시스템 정상
          </span>
        </header>
        <section className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-7">{children}</section>
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

      <div className="px-5 py-3 border-b border-white/10 bg-white/5 border-l-[3px] border-l-cyan-400">
        <div className="text-[10px] font-bold text-slate-500 tracking-widest">현재 권한</div>
        <div className="text-white text-sm font-extrabold mt-0.5 font-mono">{session.role}</div>
        <div className="text-slate-300 text-xs font-semibold mt-0.5">{session.name}</div>
      </div>

      <nav className="flex-1 py-3 text-sm overflow-y-auto">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-5 pt-4 pb-1.5 text-[9px] font-mono font-semibold text-slate-600 tracking-widest first:pt-2">
              {g.group}
            </div>
            {g.items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + '/');
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-2.5 px-5 py-3 md:py-2.5 border-l-[3px] transition ${
                    active
                      ? 'text-cyan-300 font-bold bg-cyan-500/15 border-l-cyan-400'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-transparent'
                  }`}
                >
                  <span className="flex-1">{it.label}</span>
                  {it.badge && (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                      {it.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 bg-black/15 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-extrabold shadow-card">
          {session.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-extrabold truncate">{session.name}</div>
          <div className="text-slate-500 text-[10px] font-mono font-bold mt-0.5">{session.role}</div>
        </div>
        <LogoutButton />
      </div>
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
  return <span className={`font-mono text-[11px] font-bold text-ink ${className}`}>{stamp}</span>;
}
