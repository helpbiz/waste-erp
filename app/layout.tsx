import type { Metadata, Viewport } from 'next';
import './globals.css';
import SwRegister from './_sw-register';
import GlobalNotifications from '@/components/GlobalNotifications';

export const metadata: Metadata = {
  title: 'CleanERP — 생활폐기물 수집운반 관리시스템',
  description: 'Phase 1A — 인증/RBAC/근태/실적/실시간 차량조회',
  /* manifest 는 <head> 에 직접 선언 — metadata.manifest 사용 시 Next.js가
     crossorigin="use-credentials" 를 자동 추가해 iOS Safari PWA 설치를 차단함 */
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
        {/* iOS Safari PWA 홈 화면 설치 메타태그 — appleWebApp 메타데이터 대신 직접 선언
            (appleWebApp 사용 시 manifest 링크에 crossorigin="use-credentials" 가 추가되어
             iOS PWA manifest 인식 불가) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CleanERP" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
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
