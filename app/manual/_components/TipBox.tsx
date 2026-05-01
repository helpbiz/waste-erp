import type { ReactNode } from 'react';

/** "이럴 때는 이렇게" — 부드러운 시안 톤. 안 풀릴 때 안내. */
export default function TipBox({
  title,
  children,
  label = '이럴 때는 이렇게',
}: {
  title: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <aside className="tip-box">
      <div className="tip-box-label">{label}</div>
      <div className="tip-box-title">{title}</div>
      <div className="tip-box-body">{children}</div>
    </aside>
  );
}
