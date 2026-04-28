// Design Ref: docs/02-design/mobile-ux-overhaul.md §9.1
// Plan SC: Wave 1 — Client shell with Drawer state. AppBar + Bottom Tab(5) + Drawer
'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TabLink } from './_tab-link';
import { AppBar, HamburgerButton } from '@/components/worker/AppBar';
import { WorkerDrawer } from '@/components/worker/WorkerDrawer';

type Props = {
  user: { name: string; userId: string; role: string };
  isRapid: boolean;
  children: ReactNode;
};

/* Drawer로 이동된 메뉴 prefix — More 탭 활성화 판단용 */
const DRAWER_PREFIXES = ['/worker/performance', '/worker/leave', '/worker/profile', '/worker/route'];

export function WorkerLayoutShell({ user, isRapid, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isMoreActive = DRAWER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    /* PWA 고정 — fixed inset 0 + dvh로 viewport 변동 흡수. 100vw 풀폭. */
    <div
      className="bg-surface"
      style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}
    >
      <div className="w-full h-full flex flex-col">
        {/* AppBar — safe-area-inset-top 자동 패딩 */}
        <AppBar
          title={user.name}
          subtitle={`${user.role} · ID ${user.userId}`}
          leading={<HamburgerButton onClick={() => setDrawerOpen(true)} />}
        />

        {/* 본문 */}
        <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>

        {/* Bottom Tab Bar — safe-area-inset-bottom 자동 패딩 */}
        <nav
          className="flex-shrink-0 bg-surface border-t border-line shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex w-full h-16">
            <TabLink href="/worker" label="홈" icon="home" />
            <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
            <TabLink href="/worker/complaint" label="민원" icon="camera" />
            <TabLink href="/worker/safety" label="안전" icon="shield" />
            <TabLink
              href="#"
              label="더보기"
              icon="more"
              isMore
              forceActive={isMoreActive}
              onClick={() => setDrawerOpen(true)}
            />
          </div>
        </nav>

        {/* Drawer — 실적/휴가/프로필/경로(RAPID) + 로그아웃 */}
        <WorkerDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          user={user}
          isRapid={isRapid}
        />
      </div>
    </div>
  );
}
