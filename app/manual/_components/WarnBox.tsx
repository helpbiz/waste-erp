import type { ReactNode } from 'react';

/** "주의하세요" — 빨강 대신 부드러운 앰버. 위협보다 안내 톤. */
export default function WarnBox({
  title,
  children,
  label = '주의하세요',
}: {
  title: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <aside className="warn-box">
      <div className="warn-box-label">{label}</div>
      <div className="warn-box-title">{title}</div>
      <div className="warn-box-body">{children}</div>
    </aside>
  );
}
