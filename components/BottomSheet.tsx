// Design Ref: §2.1 — 모바일 BottomSheet + 데스크탑 중앙 모달 fallback
// Plan SC: FR-01 (mobile slide-up), FR-02 (desktop fallback), FR-09 (a11y)
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 모바일 시트 높이 (기본 80vh) */
  mobileHeight?: string;
  /** 데스크탑 모달 최대 너비 (기본 600px) */
  desktopMaxWidth?: string;
  children: ReactNode;
};

const SWIPE_DOWN_DISMISS_PX = 100;

export function BottomSheet({
  open,
  onClose,
  title,
  mobileHeight = '80vh',
  desktopMaxWidth = '600px',
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);

  // body scroll lock + ESC + focus trap (Tab cycle)
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const focusables = sheet.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
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
    // mount 시 첫 focusable에 포커스
    requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const first = sheet.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    });
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // touch swipe-to-dismiss (mobile)
  function onTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startYRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragOffset(dy);
  }
  function onTouchEnd() {
    if (dragOffset > SWIPE_DOWN_DISMISS_PX) onClose();
    setDragOffset(0);
    startYRef.current = null;
  }

  if (!open) return null;

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
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-surface md:rounded-xl rounded-t-2xl shadow-modal flex flex-col
                   animate-slide-up md:animate-none
                   md:max-h-[90vh]"
        style={{
          maxHeight: mobileHeight,
          maxWidth: typeof window !== 'undefined' && window.innerWidth >= 768 ? desktopMaxWidth : '100%',
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
            <h2 className="text-base font-extrabold text-ink">{title}</h2>
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

        {/* content */}
        <div className="flex-1 overflow-y-auto" tabIndex={0}>
          {children}
        </div>
      </div>
    </div>
  );
}
