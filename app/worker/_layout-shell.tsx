// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C — Tab 6 + 헤더 아바타)
// P1-4/P1-5: 공용 shell 컴포넌트(components/shell/)로 전환
'use client';

import { type ReactNode } from 'react';
import { AppBar } from '@/components/shell/AppBar';
import { BottomTabBar, type BottomTabItem } from '@/components/shell/BottomTabBar';
import { ToastProvider } from '@/components/ui/Toast';

type Props = {
  user: { name: string; userId: string; role: string };
  isRapid: boolean;
  children: ReactNode;
};

const WORKER_TABS: BottomTabItem[] = [
  { href: '/worker', label: '홈', icon: 'home', exact: true },
  { href: '/worker/punch', label: '출퇴근', icon: 'clock' },
  { href: '/worker/complaint', label: '민원', icon: 'camera' },
  { href: '/worker/safety', label: '안전', icon: 'shield' },
  { href: '/worker/performance', label: '실적', icon: 'chart' },
  { href: '/worker/announcements', label: '공지', icon: 'bell' },
];

export function WorkerLayoutShell({ user, children }: Props) {
  return (
    <ToastProvider>
      <div
        className="bg-surface"
        style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}
      >
        <div className="w-full h-full flex flex-col">
          <AppBar
            title={user.name}
            subtitle={`${user.role} · ID ${user.userId}`}
            variant="dark"
          />
          <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>
          <BottomTabBar items={WORKER_TABS} />
        </div>
      </div>
    </ToastProvider>
  );
}
