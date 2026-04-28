// Design Ref: §2.2 — 모바일에서만 collapsible 필터, 데스크탑은 항상 펼침
// Plan SC: FR-03 (mobile collapse), FR-06 (/complaints 적용)
'use client';

import { useState, type ReactNode } from 'react';

type FilterToggleProps = {
  /** 활성 필터 수 (배지 표시) */
  activeCount?: number;
  /** 모바일 토글 버튼 텍스트 (기본: '필터') */
  label?: string;
  /** 초기 펼침 여부 (모바일 only — 데스크탑은 항상 true) */
  defaultOpen?: boolean;
  children: ReactNode;
};

export function FilterToggle({
  activeCount,
  label = '필터',
  defaultOpen = false,
  children,
}: FilterToggleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      {/* 모바일 토글 버튼 — md+에서 hidden */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filter-panel"
        className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-line bg-surface text-sm font-extrabold text-ink hover:bg-surface-soft active:scale-95 transition"
      >
        <span aria-hidden="true">🔍</span>
        <span>
          {label}
          {typeof activeCount === 'number' && activeCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent text-white text-[0.625rem] font-mono">
              {activeCount}
            </span>
          )}
        </span>
        <span className="ml-auto text-ink-muted text-xs" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {/* 필터 본문 — 모바일은 토글, 데스크탑은 항상 펼침 */}
      <div
        id="filter-panel"
        className={`${open ? 'block' : 'hidden'} md:block`}
      >
        {children}
      </div>
    </>
  );
}
