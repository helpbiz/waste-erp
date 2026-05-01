import type { ReactNode } from 'react';
import AppBarMock from './AppBarMock';
import TabBarMock, { type TabKey } from './TabBarMock';

/** 화면 목업 외곽 + 상하 구조.
    매뉴얼 안에 보이는 "이런 화면이 표시됩니다"의 단위. */

export default function ScreenShot({
  appBar,
  activeTab,
  caption,
  children,
}: {
  appBar?: { title: string; role?: 'worker' | 'admin' | 'muni'; showBack?: boolean };
  activeTab?: TabKey;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="screen-shot-wrap">
      <div className="screen-shot">
        {appBar && <AppBarMock title={appBar.title} role={appBar.role} showBack={appBar.showBack} />}
        <div className="screen-shot-body">{children}</div>
        {activeTab && <TabBarMock active={activeTab} />}
      </div>
      {caption && <div className="screen-shot-caption">{caption}</div>}
    </div>
  );
}
