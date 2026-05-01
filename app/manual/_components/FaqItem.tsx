import type { ReactNode } from 'react';

/** FAQ 1건 — <details>/<summary> 사용으로 JS 없이도 펼침/접힘 동작. */
export default function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="faq-item">
      <summary>{q}</summary>
      <div className="faq-item-body">{children}</div>
    </details>
  );
}
