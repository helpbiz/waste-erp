// Design Ref: docs/02-design/mobile-ux-overhaul.md §6.5
// pm-research 권고: skeleton 로더로 perceived performance 개선
'use client';

type SkeletonProps = {
  className?: string;
  /** 라운딩 옵션 — 기본 rounded-md */
  rounded?: 'none' | 'md' | 'full';
};

const ROUNDED_MAP = {
  none: '',
  md: 'rounded-md',
  full: 'rounded-full',
} as const;

export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-slate-200 ${ROUNDED_MAP[rounded]} ${className}`}
    />
  );
}

/* 일반 사용 패턴 */

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface rounded-2xl p-4 space-y-3 ${className}`}>
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonAvatar({ size = 12, className = '' }: { size?: number; className?: string }) {
  return <Skeleton rounded="full" className={`w-${size} h-${size} ${className}`} />;
}
