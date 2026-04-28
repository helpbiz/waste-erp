// Design Ref: docs/02-design/mobile-ux-overhaul.md §6.1
// Plan SC: Wave 1 — Sticky AppBar + safe-area-inset-top, 한손 hamburger
'use client';

import type { ReactNode } from 'react';

type AppBarProps = {
  title: string;
  subtitle?: string;
  /** 좌측 햄버거 또는 뒤로가기 버튼 */
  leading?: ReactNode;
  /** 우측 액션 (알림, 검색 등) */
  trailing?: ReactNode;
};

export function AppBar({ title, subtitle, leading, trailing }: AppBarProps) {
  return (
    <header
      className="bg-sidebar text-white flex-shrink-0 z-10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-4 h-14 flex items-center gap-3">
        {leading}
        <div className="flex-1 min-w-0">
          <div className="text-base font-extrabold leading-tight truncate">{title}</div>
          {subtitle && (
            <div className="text-[11px] font-mono font-bold text-cyan-300 mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {trailing}
      </div>
    </header>
  );
}

/** 햄버거 버튼 — 44px+ 터치 타겟 */
export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="메뉴 열기"
      className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg active:bg-white/10 transition-colors"
    >
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
