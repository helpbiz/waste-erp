import type { ReactNode } from 'react';

/** 모바일 화면 목업 프레임 — children에 실제 화면 내용 슬롯.
    매뉴얼의 모든 "이런 화면이 보입니다" 시각화는 이 컴포넌트 사용. */
export default function ScreenMock({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="screen-mock-wrap">
      <div className="screen-mock-phone">
        <div className="screen-mock-phone-screen">
          <div className="screen-mock-phone-notch" aria-hidden />
          {title && <div className="screen-mock-phone-h">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
