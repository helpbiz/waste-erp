// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C — Tab 5 + 헤더 아바타)
// frontend-architect + pm-research 합의안: 햄버거 제거. 가끔 사용 메뉴는 홈 그리드 + 헤더 아바타.
'use client';

import { type ReactNode } from 'react';
import { TabLink } from './_tab-link';
import { AppBar } from '@/components/worker/AppBar';
import { ToastProvider } from '@/components/ui/Toast';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import ComplaintBanner from '@/components/ComplaintBanner';

type Props = {
  user: { name: string; userId: string; role: string };
  /* isRapid는 홈 그리드의 추천경로 카드 표시 여부 — page.tsx에서 사용 */
  isRapid: boolean;
  children: ReactNode;
};

export function WorkerLayoutShell({ user, children }: Props) {
  return (
    /* PWA 고정 — fixed inset 0 + dvh로 viewport 변동 흡수. 100vw 풀폭. */
    <ToastProvider>
      <div
        className="bg-surface"
        style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}
      >
        <div className="w-full h-full flex flex-col">
          {/* AppBar — 헤더 아바타로 프로필 진입 (햄버거 대체) */}
          <AppBar
            title={user.name}
            subtitle={`${user.role} · ID ${user.userId}`}
            userName={user.name}
          />

          {/* 글로벌 공지 banner (사용자 요청 2026-05-01) */}
          <AnnouncementBanner />
          {/* 신규 민원 음성 알림 — 폴링 + TTS (사용자 요청 2026-05-02) */}
          <ComplaintBanner />

          {/* 본문 */}
          <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>

          {/* Bottom Tab Bar 5개 — S/A 등급 (매일 사용). 가끔 사용은 홈 그리드 + 헤더 아바타. */}
          <nav
            className="flex-shrink-0 bg-surface border-t border-line shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex w-full h-16">
              <TabLink href="/worker" label="홈" icon="home" />
              <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
              <TabLink href="/worker/complaint" label="민원" icon="camera" />
              <TabLink href="/worker/safety" label="안전" icon="shield" />
              <TabLink href="/worker/performance" label="실적" icon="chart" />
            </div>
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
