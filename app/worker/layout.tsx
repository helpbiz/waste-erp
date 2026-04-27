import { redirect } from 'next/navigation';
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import LogoutButton from '../(admin)/_logout-button';

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard'); // 관리자 차단

  return (
    <div className="min-h-screen flex justify-center bg-page">
      {/* 모바일 디바이스 시뮬레이션 (max-width 480px) */}
      <div className="w-full max-w-[480px] min-h-screen bg-surface flex flex-col shadow-card relative">
        {/* 상단 헤더 */}
        <header className="px-5 py-3.5 bg-sidebar text-white flex items-center gap-3 sticky top-0 z-10">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-card flex-shrink-0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-extrabold leading-tight truncate">{session.name}</div>
            <div className="text-[11px] font-mono font-bold text-cyan-300 mt-0.5">
              WORKER · ID {session.userId}
            </div>
          </div>
          <LogoutButton />
        </header>

        {/* 본문 (하단 탭 높이만큼 여유) */}
        <main className="flex-1 pb-[68px] overflow-y-auto">{children}</main>

        {/* 하단 탭 네비 */}
        <nav className="absolute bottom-0 left-0 right-0 h-[68px] bg-surface border-t-2 border-line flex items-stretch shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <TabLink href="/worker" label="홈" icon="home" />
          <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
          <TabLink href="/worker/complaint" label="민원" icon="camera" />
          <TabLink href="/worker/safety" label="안전" icon="shield" />
          <TabLink href="/worker/performance" label="실적" icon="chart" />
        </nav>
      </div>
    </div>
  );
}

function TabLink({ href, label, icon }: { href: string; label: string; icon: 'home' | 'clock' | 'camera' | 'shield' | 'chart' }) {
  const paths: Record<typeof icon, string> = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  };
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 text-ink-muted hover:text-accent active:bg-surface-soft transition"
    >
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon]} />
      </svg>
      <span className="text-[11px] font-extrabold">{label}</span>
    </Link>
  );
}
