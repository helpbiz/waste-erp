import type { ReactNode } from 'react';
import SidebarMock from './SidebarMock';

/** 데스크톱 콘솔 화면 목업 — 브라우저바 + 사이드바 + 메인 영역.
    width 520px (관리자 매뉴얼 inline 표시용). */

export default function DesktopShot({
  url = 'wci.helpbiz.kr/dashboard',
  active,
  variant = 'admin',
  caption,
  children,
}: {
  /** 브라우저 주소창 표시용 URL */
  url?: string;
  /** 사이드바에서 활성 표시할 메뉴 (정확한 한글 라벨) */
  active?: string;
  variant?: 'admin' | 'muni';
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="desktop-shot-wrap">
      <div className="desktop-shot">
        <div className="desktop-shot-bar">
          <span className="desktop-shot-dots">
            <span data-c="r" /><span data-c="y" /><span data-c="g" />
          </span>
          <span className="desktop-shot-url">{url}</span>
        </div>
        <div className="desktop-shot-body">
          <SidebarMock active={active} variant={variant} />
          <div className="desktop-shot-main">{children}</div>
        </div>
      </div>
      {caption && <div className="screen-shot-caption">{caption}</div>}
    </div>
  );
}
