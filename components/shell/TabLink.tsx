'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICON_PATHS = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  camera:
    'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  shield:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  more: 'M4 6h16M4 12h16M4 18h16',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
} as const;

export type IconKey = keyof typeof ICON_PATHS;

export type TabLinkProps = {
  href: string;
  label: string;
  icon: IconKey;
  /** true: pathname 정확히 일치할 때만 활성 (섹션 루트 탭에 사용) */
  exact?: boolean;
  isMore?: boolean;
  onClick?: () => void;
  forceActive?: boolean;
};

export function TabLink({ href, label, icon, exact = false, isMore = false, onClick, forceActive }: TabLinkProps) {
  const pathname = usePathname();
  const matched = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  const active = forceActive ?? matched;

  const inner = (
    <>
      {active && (
        <span aria-hidden className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-full" />
      )}
      <svg
        width="26"
        height="26"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
        className={active ? 'text-accent' : 'text-ink-faint'}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon]} />
      </svg>
      <span
        className={`text-[0.8125rem] leading-none ${active ? 'text-accent font-extrabold' : 'text-ink-muted font-bold'}`}
      >
        {label}
      </span>
    </>
  );

  const cls =
    'flex-1 flex flex-col items-center justify-center gap-1 relative min-h-[56px] active:bg-surface-soft/60 transition-colors duration-100';

  if (isMore) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className={cls}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cls}>
      {inner}
    </Link>
  );
}
