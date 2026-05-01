import type { ReactNode } from 'react';

/** 리스트 1행 목업 — 카드 형태 (제목·서브 + 우측 상태/뱃지). */
export default function ListItemMock({
  title,
  sub,
  right,
  highlighted = false,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className="mock-list-item" data-highlighted={highlighted}>
      <div className="mock-list-item-main">
        <div className="mock-list-item-title">{title}</div>
        {sub && <div className="mock-list-item-sub">{sub}</div>}
      </div>
      {right && <div className="mock-list-item-right">{right}</div>}
    </div>
  );
}
