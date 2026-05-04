// Design Ref: §2.1 — 모바일 BottomSheet + 데스크탑 중앙 모달 fallback
// Plan SC: FR-01 (mobile slide-up), FR-02 (desktop fallback), FR-09 (a11y)
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** aria-label fallback when title is omitted */
  ariaLabel?: string;
  /** 모바일 시트 높이 (기본 80vh) */
  mobileHeight?: string;
  /** 데스크탑 모달 최대 너비 (기본 600px) */
  desktopMaxWidth?: string;
  children: ReactNode;
};

const SWIPE_DOWN_DISMISS_PX = 100;

// [Fix #5] stack-safe scroll lock via ref count
let _scrollLockCount = 0;
function lockScroll() {
  if (_scrollLockCount === 0) document.body.style.overflow = 'hidden';
  _scrollLockCount++;
}
function unlockScroll() {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1);
  if (_scrollLockCount === 0) document.body.style.overflow = '';
}

// [Fix #2] focusable selector that excludes disabled/hidden elements
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function getVisible(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[aria-hidden="true"]') && el.offsetParent !== null,
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  mobileHeight = '80vh',
  desktopMaxWidth = '600px',
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);

  // [Fix #5] stack-safe scroll lock + ESC + focus trap
  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const focusables = getVisible(sheet);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    // [Fix #6] initial focus → first field inside content, skip close button
    requestAnimationFrame(() => {
      const content = contentRef.current;
      if (!content) return;
      const first = getVisible(content)[0];
      first?.focus();
    });

    return () => {
      unlockScroll();
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // [Fix #3] swipe-to-dismiss: only when content is at top + vertical intent
  function onTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startYRef.current == null || startXRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    const dx = e.touches[0].clientX - startXRef.current;
    // only engage vertical swipe when content is scrolled to top
    const atTop = (contentRef.current?.scrollTop ?? 0) === 0;
    if (dy > 0 && atTop && Math.abs(dy) > Math.abs(dx)) {
      setDragOffset(dy);
    }
  }
  function onTouchEnd() {
    if (dragOffset > SWIPE_DOWN_DISMISS_PX) onClose();
    setDragOffset(0);
    startYRef.current = null;
    startXRef.current = null;
  }

  if (!open) return null;

  // [Fix #4] accessible name: title → h2 labelledby, ariaLabel fallback, default '대화상자'
  const dialogLabel = ariaLabel ?? title ?? '대화상자';
  const labelId = title ? 'bottom-sheet-title' : undefined;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-end md:items-center justify-center md:px-4"
      onClick={onClose}
      aria-hidden={false}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : dialogLabel}
        onClick={(e) => e.stopPropagation()}
        // [Fix #1] desktopMaxWidth via CSS var — no window.innerWidth in render
        className="w-full bg-surface md:rounded-xl rounded-t-2xl shadow-modal flex flex-col
                   animate-slide-up md:animate-none
                   md:max-h-[90vh]"
        style={{
          maxHeight: mobileHeight,
          // [Fix #1] CSS custom property applied on desktop via md: class override below
          ['--sheet-max-w' as string]: desktopMaxWidth,
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset === 0 ? 'transform 0.2s' : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* drag handle (모바일만) */}
        <div className="md:hidden pt-2 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {/* header */}
        {title && (
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h2 id="bottom-sheet-title" className="text-base font-extrabold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="text-ink-muted hover:text-ink p-1 -mr-1 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* [Fix #6] content ref — initial focus targets here, not header */}
        <div ref={contentRef} className="flex-1 overflow-y-auto" tabIndex={-1}>
          {children}
        </div>
      </div>

      {/* [Fix #1] desktop max-width via stylesheet injection — avoids window.innerWidth in render */}
      <style>{`
        @media (min-width: 768px) {
          [role="dialog"][aria-modal="true"] { max-width: var(--sheet-max-w, 600px); }
        }
      `}</style>
    </div>
  );
}
