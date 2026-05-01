import type { ReactNode } from 'react';
import Link from 'next/link';
import StepCard from './StepCard';
import TipBox from './TipBox';
import WarnBox from './WarnBox';
import FaqItem from './FaqItem';

/** 매뉴얼 챕터 — 모든 역할 매뉴얼이 이 컴포넌트로 챕터를 렌더한다.
    데이터 구조에 따라 welcome / standard / faq 세 종류 자동 분기. */

export type StandardStep = { title: string; body: string };
export type ChapterTip = { title: string; body: string };

export type ChapterData =
  | {
      kind: 'welcome';
      num: string;
      title: string;
      lead: string;
      intro?: string;
      canDo: { title: string; body: string }[];
    }
  | {
      kind: 'standard';
      num: string;
      title: string;
      lead: string;
      steps: StandardStep[];
      tip?: ChapterTip;
      warn?: ChapterTip;
      nextHref?: string;
      nextDesc?: string;
    }
  | {
      kind: 'faq';
      num: string;
      title: string;
      lead: string;
      faqs: { q: string; a: string }[];
    };

export default function Chapter({ ch }: { ch: ChapterData }): ReactNode {
  return (
    <>
      <section className="manual-chapter" id={ch.num}>
        <div className="manual-chapter-num">CHAPTER {ch.num}</div>
        <h2 className="manual-chapter-title">{ch.title}</h2>
        <p className="manual-chapter-lead">{ch.lead}</p>

        {ch.kind === 'welcome' && (
          <>
            {ch.intro && <p style={{ fontSize: 17, color: '#334155', lineHeight: 1.7, marginBottom: 24, maxWidth: 720 }}>{ch.intro}</p>}
            <div className="step-list">
              {ch.canDo.map((c) => (
                <StepCard key={c.title} n={'✓'} title={c.title} body={c.body} />
              ))}
            </div>
          </>
        )}

        {ch.kind === 'standard' && (
          <>
            <div className="step-list">
              {ch.steps.map((s, i) => (
                <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
              ))}
            </div>
            {ch.tip && <TipBox title={ch.tip.title}>{ch.tip.body}</TipBox>}
            {ch.warn && <WarnBox title={ch.warn.title}>{ch.warn.body}</WarnBox>}
            {ch.nextHref && ch.nextDesc && (
              <Link href={ch.nextHref} className="next-step" style={{ textDecoration: 'none' }}>
                <div>
                  <div className="next-step-label">다음 단계</div>
                  <div className="next-step-title">{ch.nextDesc}</div>
                </div>
                <span className="next-step-arrow" aria-hidden>→</span>
              </Link>
            )}
          </>
        )}

        {ch.kind === 'faq' && (
          <div className="faq-list">
            {ch.faqs.map((f) => (
              <FaqItem key={f.q} q={f.q}>
                <p>{f.a}</p>
              </FaqItem>
            ))}
          </div>
        )}
      </section>
      <div className="manual-divider" />
    </>
  );
}
