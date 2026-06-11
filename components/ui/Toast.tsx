// Design Ref: docs/02-design/mobile-ux-overhaul.md §6.4
// pm-research 권고: 인라인 배너 → Toast (3s 자동 소멸, 화면 흐름 단절 없음)
'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info', durationMs = 3000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => remove(id), durationMs);
  }, [remove]);

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, 'success', d),
    error: (m, d) => show(m, 'error', d),
    info: (m, d) => show(m, 'info', d),
    warning: (m, d) => show(m, 'warning', d),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    /* Provider 외부에서 호출 시 silent fallback — 페이지 단독 렌더 시 깨지지 않게 */
    const noop: ToastContextValue = {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
    return noop;
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
  warning: 'bg-amber-500 text-ink-muted',
};

const ICONS: Record<ToastVariant, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

function ToastViewport({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div
      role="region"
      aria-label="알림"
      aria-live="polite"
      className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onRemove(t.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 ${VARIANT_STYLES[t.variant]} animate-toast-in`}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} className="flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[t.variant]} />
          </svg>
          <span className="flex-1 text-left text-sm font-bold">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

/* CSS 애니메이션은 globals.css에 정의 — animate-toast-in */
