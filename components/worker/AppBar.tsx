// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C 변형 — 탭 5 + 헤더 로그아웃)
// PWA Mobile UX Mastering 2026-04-28: 우상단 default를 ProfileAvatar → LogoutButton(compact) 으로 변경.
// 사용자 보고 결함 "로그아웃 어디 있는지 못 찾음" 의 직접 해결 — 모든 worker 화면 우상단 1탭.
// 프로필 진입은 worker 홈 기타 메뉴 그리드의 "내 프로필" 카드로 유지 (app/worker/page.tsx).
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import LogoutButton from '@/app/(admin)/_logout-button';

/** 매뉴얼 진입 — AppBar 우상단 ❓ 아이콘. 사용자가 어디서든 1탭에 도움말 */
function HelpButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="사용 매뉴얼"
      title="사용법 보기 (새 창)"
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition"
    >
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </Link>
  );
}

type AppBarProps = {
  title: string;
  subtitle?: string;
  /** 좌측 아이템 (뒤로가기 등 — 미사용 시 비움) */
  leading?: ReactNode;
  /** 우측 액션 (기본: LogoutButton compact). ProfileAvatar 사용 원할 시 명시적으로 전달 */
  trailing?: ReactNode;
  /** 사용자 이름 — 과거 ProfileAvatar 이니셜용. 기본 trailing 변경 후 사용처 없으나 backward-compat 유지 */
  userName?: string;
};

export function AppBar({ title, subtitle, leading, trailing, userName: _userName }: AppBarProps) {
  return (
    <header
      className="bg-sidebar text-white flex-shrink-0 z-10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-3 h-14 flex items-center gap-2">
        {leading}
        <div className="flex-1 min-w-0">
          {/* P1: 16px → 18px (text-lg) — 시니어 가독성 */}
          <div className="text-lg font-extrabold leading-tight truncate">{title}</div>
          {subtitle && (
            /* P1: 11px → 13px, cyan-300 (#67e8f9) on sidebar = 8.5:1 AAA OK */
            <div className="text-[0.8125rem] font-mono font-bold text-cyan-300 mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {/* default trailing: ❓ 도움말 + 로그아웃 (compact).
            customize 필요 시 trailing prop 으로 override */}
        {trailing ?? (
          <div className="flex items-center gap-1.5">
            <HelpButton href="/manual/worker" />
            <LogoutButton variant="compact" />
          </div>
        )}
      </div>
    </header>
  );
}

/** 프로필 아바타 — 클릭 시 /worker/profile. 40px+ 터치 타겟, 야외 가시성 강조.
    햄버거 hidden cost 회피 — 아바타는 사용자 이름 글자 visible. */
export function ProfileAvatar({ name }: { name: string }) {
  /* 이름의 마지막 글자 (한국 이름 패턴 — 보통 이름 끝 글자가 식별성) */
  const initial = name.slice(-1) || '?';
  return (
    <Link
      href="/worker/profile"
      aria-label={`${name} 프로필`}
      className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-black text-base shadow-md active:scale-95 active:bg-cyan-700 transition-transform"
    >
      {initial}
    </Link>
  );
}

/** 햄버거 버튼 — Option C에서 더 이상 layout에서 사용 안 함. 서브 페이지 메뉴용 보존. */
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
