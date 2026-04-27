import type { Metadata, Viewport } from 'next';
import './globals.css';
import SwRegister from './_sw-register';

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
      </head>
      <body className="font-sans antialiased text-ink bg-page">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
