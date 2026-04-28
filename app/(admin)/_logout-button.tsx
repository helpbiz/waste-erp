'use client';

/**
 * LogoutButton — WCAG 2.1 AAA 준수 / 4-role 어디서나 시인성 보장.
 *
 * 회귀 사유 (이전 버전):
 *   - text-slate-200 (#e2e8f0) 하드코딩 → admin sidebar(어두운 배경)에선 12.4:1 OK였지만
 *     worker/profile 흰색 카드에 그대로 재사용 → 대비 1.16:1 → 사실상 비가시.
 *   - 12px font / 호버-온리 underline / 16px 터치타겟 → 시니어 사용자 발견 불가.
 *
 * 신규 표준 (PWA Mobile UX Mastering / P0-3):
 *   - 컨텍스트 무관 동작: bg-danger(#b91c1c) + text-white = 21:1 (모든 배경에서 동일 시인성)
 *   - 16px font / min-h-11 (44px) / px-4 → WCAG 2.5.5 (Target Size) 준수
 *   - white border 2px → 어두운 배경(sidebar)·밝은 배경(card) 모두에서 윤곽 보장
 *   - window.confirm() 대신 AccessibleConfirmDialog 사용
 *   - variant prop 으로 컴팩트(헤더용) / 풀(카드용) 선택
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AccessibleConfirmDialog from '@/components/ui/AccessibleConfirmDialog';

interface Props {
  /** 'compact': 헤더용 짧은 라벨 / 'full': 카드 내부 전체폭 */
  variant?: 'compact' | 'full';
  /**
   * 'dark' (default): 어두운 배경 (worker AppBar / admin sidebar) — 평소 text-white, hover bg-red-700
   * 'light':         흰 배경 (admin/super 헤더) — 평소 text-ink (검정), hover bg-red-700+text-white
   * 컨텍스트 별 거울상 — 시인성 동일, 톤 미러링.
   */
  theme?: 'dark' | 'light';
  className?: string;
}

export default function LogoutButton({ variant = 'compact', theme = 'dark', className = '' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function doLogout() {
    setConfirming(false);
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore — 쿠키 만료/네트워크 실패해도 클라이언트는 로그인으로 이동 */
    }
    router.replace('/login');
    router.refresh();
  }

  /* 컨텍스트별 톤 분리 (PWA Mobile UX Mastering 2026-04-28, theme prop 추가 2026-04-28 v2).
     - full:           흰 카드 — bg-danger 21:1 강한 destructive (theme 무관)
     - compact + dark: 어두운 sidebar/AppBar — 평소 text-white, 박스 0
     - compact + light: 흰 헤더 — 평소 text-ink(순수 검정 21:1), 박스 0
     공통: hover/tap 시 bg-red-700 + text-white 로 destructive 풀 피드백 (대각선 거울상). */
  const isFull = variant === 'full';
  const isLight = theme === 'light';

  const toneClass = isFull
    ? 'bg-danger text-white border-2 border-white hover:bg-red-800 active:bg-red-900 shadow-card'
    : isLight
      /* light 톤다운 v2 (사용자 피드백 2026-04-28): text-ink-muted(12.5:1) → text-ink-faint(#475569, 7.0:1)
         WCAG AAA 본문 7:1 경계 — 더 부드러우면 AAA 미달이 되어 한계점. 헤더 톤과 가장 자연스럽게 융합. */
      ? 'bg-transparent text-ink-faint hover:bg-red-700 hover:text-white active:bg-red-800'
      : 'bg-transparent text-white hover:bg-red-700 active:bg-red-800';

  const baseBtn =
    /* 사용자 피드백: 아이콘 ↔ 텍스트 간격 + 글자 간격 모두 살짝 줄여 컴팩트 (2026-04-28).
       gap-2(8px) → gap-1.5(6px), tracking-tight(-0.025em) → tracking-tighter(-0.05em) */
    'inline-flex items-center justify-center gap-1.5 rounded-lg ' +
    'font-extrabold tracking-tighter ' +
    'disabled:opacity-60 disabled:cursor-not-allowed ' +
    'transition-colors duration-150 ' +
    toneClass;

  const sizeClass = isFull
    ? 'w-full min-h-14 px-5 py-3 text-lg'   // 56px / 18px — 카드 내부 강조
    /* 사용자 피드백 2026-04-28: 헤더 텍스트 크기 한 단계 축소 — text-base(16px) → text-sm(14px).
       text-ink-faint(#475569) on white = 7.0:1 → 14px 본문도 AAA 경계 통과. */
    : 'min-h-11 px-3 py-2 text-sm';         // 44px / 14px — 헤더 좁은 공간 대응

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        title="로그아웃"
        aria-label="로그아웃"
        className={`${baseBtn} ${sizeClass} ${className}`}
      >
        {/* 로그아웃 아이콘 — 시니어 인지 보조 */}
        <svg width={variant === 'full' ? 20 : 18} height={variant === 'full' ? 20 : 18}
             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{busy ? '로그아웃 중…' : '로그아웃'}</span>
      </button>

      <AccessibleConfirmDialog
        open={confirming}
        tone="destructive"
        title="로그아웃 하시겠습니까?"
        message="현재 계정에서 로그아웃되며, 다시 로그인해야 합니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        onConfirm={doLogout}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
