// P1-5: components/shell/AppBar 로 이관. 이 파일은 하위 호환용 re-export + worker-only 컴포넌트 보존.
export { AppBar } from '@/components/shell/AppBar';
export type { AppBarVariant } from '@/components/shell/AppBar';

import Link from 'next/link';

/** 프로필 아바타 — 클릭 시 /worker/profile. 이름 끝 글자 이니셜. */
export function ProfileAvatar({ name }: { name: string }) {
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

/** 햄버거 버튼 — 서브 페이지 메뉴용 보존 (layout에서는 미사용). */
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
