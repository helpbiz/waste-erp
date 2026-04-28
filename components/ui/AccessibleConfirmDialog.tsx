'use client';

/**
 * AccessibleConfirmDialog — WCAG 2.1 AAA 준수 확인 다이얼로그.
 *
 * 도입 사유 (PWA Mobile UX Mastering / P0-4):
 *   - 기존 window.confirm() 은 모바일에서 OS 다이얼로그라 디자인 통제 불가, 폰트/대비 불보장.
 *   - 시니어 사용자 가독성 보장 (18px 본문, 44px 터치, 21:1 대비, 명확한 액션 라벨).
 *
 * 접근성 보장:
 *   - role="alertdialog" + aria-labelledby + aria-describedby
 *   - ESC → 취소
 *   - 백드롭 클릭 → 비파괴 액션은 닫힘, 파괴 액션(destructive)은 무시 (실수 방지)
 *   - 마운트 시 첫 포커스를 취소 버튼에 (실수 클릭 방지)
 *   - 포커스 트랩 (Tab 순환)
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';

export type ConfirmTone = 'destructive' | 'neutral';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AccessibleConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'neutral',
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  /* 마운트 시 취소 버튼 포커스 — 파괴적 액션 실수 방지 */
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  /* body scroll lock — 다이얼로그 뒤 스크롤 차단 */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    /* 단순 포커스 트랩: 두 버튼 사이만 순환 */
    if (e.key === 'Tab') {
      const a = cancelRef.current;
      const b = confirmRef.current;
      if (!a || !b) return;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    }
  }

  function handleBackdrop() {
    /* 파괴적 액션은 백드롭 클릭으로 닫지 않음 — 실수 방지 */
    if (tone === 'destructive') return;
    onCancel();
  }

  /* 사용자 피드백 2026-04-28: destructive 도 메인 색상(accent #0e7490) 으로 통일.
     bg-danger(red) 가 너무 jarring 하다는 피드백 — 다이얼로그 본문에 이미 "로그아웃" 등 destructive
     의도가 텍스트로 명시되므로 버튼 색상은 브랜드 일관성 우선. */
  const confirmBtn =
    'bg-accent text-white border-2 border-white hover:bg-cyan-800 active:bg-cyan-900';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="acd-title"
      aria-describedby={message ? 'acd-msg' : undefined}
      onKeyDown={handleKey}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleBackdrop}
        className="absolute inset-0 bg-black/60 cursor-default"
      />

      {/* Panel — 본문 18px, 제목 22px, 패딩 24px */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-modal p-6 sm:p-7">
        <h2 id="acd-title" className="text-xl sm:text-[1.375rem] font-extrabold text-ink-mid leading-snug">
          {title}
        </h2>

        {message && (
          <p id="acd-msg" className="mt-3 text-base sm:text-lg font-medium text-ink-mid leading-relaxed">
            {message}
          </p>
        )}

        {/* 사용자 요청 2026-04-29: 취소/확정 버튼 중앙정렬 (sm:justify-end → sm:justify-center) */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-center gap-2 sm:gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 py-3 rounded-lg bg-white text-ink-mid border-2 border-line-strong text-base font-bold hover:bg-surface-soft active:bg-surface-alt"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`min-h-11 px-5 py-3 rounded-lg text-base font-extrabold transition-colors ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
