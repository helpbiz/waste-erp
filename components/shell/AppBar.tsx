'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import LogoutButton from '@/app/(admin)/_logout-button';

/** 'dark': bg-sidebar + white (Worker), 'light': bg-surface + ink (관리자 모바일 등) */
export type AppBarVariant = 'dark' | 'light';

type AppBarProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  variant?: AppBarVariant;
  manualHref?: string;
  userName?: string;
};

function HelpButton({ href, variant = 'dark' }: { href: string; variant?: AppBarVariant }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="사용 매뉴얼"
      title="사용법 보기 (새 창)"
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition active:scale-95 ${
        variant === 'dark'
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-ink/5 hover:bg-ink/10 text-ink-soft'
      }`}
    >
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </Link>
  );
}

export function AppBar({
  title,
  subtitle,
  leading,
  trailing,
  variant = 'dark',
  manualHref,
  userName: _userName,
}: AppBarProps) {
  const bgCls =
    variant === 'dark' ? 'bg-sidebar text-white' : 'bg-surface text-ink border-b border-line';
  const subtitleCls = variant === 'dark' ? 'text-cyan-300' : 'text-ink-soft';

  return (
    <header
      className={`${bgCls} flex-shrink-0 z-10`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-3 h-14 flex items-center gap-2">
        {leading}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold leading-tight truncate">{title}</div>
          {subtitle && (
            <div className={`text-[0.8125rem] font-mono font-bold mt-0.5 truncate ${subtitleCls}`}>
              {subtitle}
            </div>
          )}
        </div>
        {trailing ?? (
          <div className="flex items-center gap-1.5">
            <HelpButton href={manualHref ?? (variant === 'dark' ? '/manual/worker' : '/manual/contractor')} variant={variant} />
            <LogoutButton variant="compact" />
          </div>
        )}
      </div>
    </header>
  );
}
