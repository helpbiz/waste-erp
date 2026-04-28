// Design Ref: docs/02-design/mobile-ux-overhaul.md §6.2
// Plan SC: Wave 1 — 좌측 드로어. 8개 메뉴 중 탭바에 없는 항목 (실적·휴가·프로필·경로) + 로그아웃
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../../app/(admin)/_logout-button';

type WorkerDrawerProps = {
  open: boolean;
  onClose: () => void;
  user: { name: string; userId: string; role: string };
  isRapid: boolean;
};

type DrawerItem = {
  href: string;
  label: string;
  iconPath: string;
  /** 직책 RAPID 만 노출 */
  rapidOnly?: boolean;
};

const ITEMS: DrawerItem[] = [
  {
    href: '/worker/performance',
    label: '실적',
    iconPath:
      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/worker/leave',
    label: '휴가',
    iconPath:
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/worker/route',
    label: '추천경로',
    iconPath:
      'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    rapidOnly: true,
  },
  {
    href: '/worker/profile',
    label: '프로필',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

export function WorkerDrawer({ open, onClose, user, isRapid }: WorkerDrawerProps) {
  const pathname = usePathname();

  /* Escape 키로 닫기 (a11y) */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* 본문 스크롤 잠금 */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const visibleItems = ITEMS.filter((it) => !it.rapidOnly || isRapid);

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="워커 메뉴"
        aria-hidden={!open}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[78%] max-w-[320px] bg-surface shadow-2xl flex flex-col transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 사용자 카드 */}
        <div className="bg-sidebar text-white px-5 py-5">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-xl font-black mb-3">
            {user.name.slice(-1)}
          </div>
          <div className="text-lg font-extrabold leading-tight truncate">{user.name}</div>
          <div className="text-xs font-mono text-cyan-300 mt-0.5">
            {user.role} · ID {user.userId}
          </div>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleItems.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-4 px-5 py-4 min-h-[56px] active:bg-surface-soft transition-colors ${
                  active ? 'bg-accent/5 text-accent' : 'text-ink'
                }`}
              >
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="flex-shrink-0"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={it.iconPath} />
                </svg>
                <span className={`text-base ${active ? 'font-extrabold' : 'font-bold'}`}>
                  {it.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* 하단 — 로그아웃 */}
        <div className="border-t border-line px-5 py-4">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
