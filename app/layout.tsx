import type { Metadata, Viewport } from 'next';
import './globals.css';
import SwRegister from './_sw-register';
import GlobalNotifications from '@/components/GlobalNotifications';

export const metadata: Metadata = {
  title: 'CleanERP — 생활폐기물 수집운반 관리시스템',
  description: 'Phase 1A — 인증/RBAC/근태/실적/실시간 차량조회',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'CleanERP',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0e7490',
  width: 'device-width',
  initialScale: 1,
  /* PWA Mobile UX Mastering — 사용자 요청 2026-04-29: 로그인 화면 크기 잠금 강화.
     userScalable: true → false 로 전환 — 모든 줌 시도(핀치/더블탭) 완전 차단.
     OS 레벨 접근성 줌(iOS 손쉬운 사용)은 여전히 작동하므로 시각장애 사용자는 영향 없음. */
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',  /* iOS 노치/홈 인디케이터 영역 보정 */
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&display=swap"
        />
        {/* SW 즉시 업데이트 — HTML은 network-first로 항상 신선. 캐시된 청크 무관하게 실행 */}
        <script dangerouslySetInnerHTML={{ __html: `
          if('serviceWorker' in navigator){
            navigator.serviceWorker.getRegistration('/').then(function(r){if(r)r.update();});
          }
        `}} />
      </head>
      <body className="font-sans antialiased text-ink bg-page">
        <SwRegister />
        {children}
        {/* 글로벌 알림 — 어떤 화면이든 자동 팝업·TTS·진동 (비로그인 시 401 silent) */}
        <GlobalNotifications />
      </body>
    </html>
  );
}
