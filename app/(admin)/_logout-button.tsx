'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore — 쿠키만 지워도 로그인 화면으로 이동 */
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="로그아웃"
      aria-label="로그아웃"
      className="text-[12px] font-extrabold tracking-tight
                 text-slate-500 hover:text-red-400
                 hover:underline underline-offset-2
                 disabled:opacity-50 disabled:cursor-not-allowed
                 bg-transparent border-0 px-1 py-0.5
                 transition-colors duration-150"
    >
      {busy ? '처리중...' : '로그아웃'}
    </button>
  );
}
