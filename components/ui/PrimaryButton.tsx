// Design Ref: docs/02-design/mobile-ux-overhaul.md §5 Sticky CTA + §4 터치 타겟
// pm-research 권고: 풀-너비 CTA + 56dp 장갑 타겟 + 햅틱 피드백
'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { hapticLight, hapticSuccess, hapticError } from '@/lib/haptics';

type Variant = 'primary' | 'danger' | 'success' | 'secondary';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** 풀-너비 (기본값 true — 모바일 CTA 용도) */
  fullWidth?: boolean;
  /** 햅틱 피드백 (기본 light, 비활성화: 'none') */
  haptic?: 'light' | 'success' | 'error' | 'none';
  /** 로딩 상태 — true면 스피너 표시 + 비활성화 */
  loading?: boolean;
  loadingText?: string;
};

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-accent text-white active:bg-cyan-700 shadow-md',
  danger: 'bg-red-600 text-white active:bg-red-700 shadow-md',
  success: 'bg-green-600 text-white active:bg-green-700 shadow-md',
  secondary: 'bg-slate-100 text-ink-muted active:bg-slate-200 border border-slate-200',
};

export const PrimaryButton = forwardRef<HTMLButtonElement, Props>(function PrimaryButton(
  {
    variant = 'primary',
    fullWidth = true,
    haptic: hap = 'light',
    loading = false,
    loadingText = '처리중...',
    disabled,
    onClick,
    children,
    className = '',
    ...rest
  },
  ref
) {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (loading || disabled) return;
    if (hap === 'success') hapticSuccess();
    else if (hap === 'error') hapticError();
    else if (hap === 'light') hapticLight();
    onClick?.(e);
  };

  /* 56dp = 14 * 4 (Tailwind h-14). 야외 장갑 환경 권장 (pm-research) */
  return (
    <button
      ref={ref}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`min-h-14 px-5 py-3 rounded-xl text-base font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
        fullWidth ? 'w-full' : ''
      } ${VARIANT_STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/** Sticky bottom CTA 컨테이너 — safe-area-inset-bottom 자동 처리 */
export function StickyCtaBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`sticky bottom-0 left-0 right-0 bg-surface border-t border-line px-4 py-3 ${className}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      {children}
    </div>
  );
}
