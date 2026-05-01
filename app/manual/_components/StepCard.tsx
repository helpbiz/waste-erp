import type { ReactNode } from 'react';

/** 절차 단계 카드 — 큰 번호 + 제목 + 본문 + 선택적 children(보조 박스/목업).
    매뉴얼의 모든 "한 단계"는 이 컴포넌트로 표현. */
export default function StepCard({
  n,
  title,
  body,
  children,
}: {
  n: number | string;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="step-card">
      <div className="step-num" aria-label={`단계 ${n}`}>{n}</div>
      <div className="step-content">
        <h3 className="step-title">{title}</h3>
        {body && <div className="step-body">{body}</div>}
        {children}
      </div>
    </article>
  );
}
