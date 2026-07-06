/**
 * 딜러 섹션 공통 레이아웃 — /dealer/leads, /dealer/demo 간 이동 네비게이션.
 * 2026-07-06 추가: 페이지는 있었지만 서로를 오갈 메뉴가 없어 /dealer/demo가
 * 화면에 노출되지 않는 문제가 있었음(사용자 리포트로 발견) — 이 레이아웃으로 해결.
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import LogoutButton from '@/app/(admin)/_logout-button';
import DealerNav from './_dealer-nav';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'DEALER') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">CleanERP 딜러</span>
            <DealerNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">{session.name}</span>
            <LogoutButton variant="compact" theme="light" />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
