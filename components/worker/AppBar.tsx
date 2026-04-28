// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C — 탭 5 + 헤더 아바타)
// pm-research: 햄버거 제거 + 프로필 진입은 헤더 아바타로 (가시화 패턴)
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type AppBarProps = {
  title: string;
  subtitle?: string;
  /** 좌측 아이템 (뒤로가기 등 — 미사용 시 비움) */
  leading?: ReactNode;
  /** 우측 액션 (기본: 프로필 아바타 link) */
  trailing?: ReactNode;
  /** 사용자 이름 — 아바타 이니셜 추출용 (trailing 미지정 시 기본 아바타 표시) */
  userName?: string;
};

export function AppBar({ title, subtitle, leading, trailing, userName }: AppBarProps) {
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
        {trailing ?? (userName ? <ProfileAvatar name={userName} /> : null)}
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
