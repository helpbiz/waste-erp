import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import LogoutButton from '../(admin)/_logout-button';
import { TabLink } from './_tab-link';

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard'); // 관리자 차단

  /* 직책 RAPID(기동반)만 추천경로 탭 노출 — position 단위 권한 게이트 */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { position: { select: { code: true } } },
  });
  const isRapid = me?.position?.code === 'RAPID';

  return (
    /* PWA 고정 — fixed inset 0 + dvh 로 viewport 변동(주소바·키보드)에 흔들림 없음 */
    <div
      className="flex justify-center bg-page"
      style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}
    >
      {/* 모바일 디바이스 시뮬레이션 (max-width 480px), 풀 높이 */}
      <div className="w-full max-w-[480px] h-full bg-surface flex flex-col shadow-card relative">
        {/* 상단 헤더 */}
        <header className="px-5 py-3.5 bg-sidebar text-white flex items-center gap-3 flex-shrink-0 z-10">
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

        {/* 본문 — 헤더와 nav 사이 flex-1, 하단 탭 위로는 자연스럽게 끊김 (공백 없음) */}
        <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>

        {/* 하단 탭 네비 — flex-shrink-0 으로 본문과 즉시 인접 (공백 없음) */}
        <nav className="h-[68px] flex-shrink-0 bg-surface border-t-2 border-line flex items-stretch shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <TabLink href="/worker" label="홈" icon="home" />
          <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
          <TabLink href="/worker/complaint" label="민원" icon="camera" />
          {isRapid && <TabLink href="/worker/route" label="경로" icon="route" />}
          <TabLink href="/worker/safety" label="안전" icon="shield" />
          <TabLink href="/worker/performance" label="실적" icon="chart" />
        </nav>
      </div>
    </div>
  );
}

