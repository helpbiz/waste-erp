import Link from 'next/link';
import '../manual.css';
import PrintButton from '../_components/PrintButton';
import StepCard from '../_components/StepCard';
import TipBox from '../_components/TipBox';
import WarnBox from '../_components/WarnBox';
import FaqItem from '../_components/FaqItem';
import RoleBadge from '../_components/RoleBadge';
import { MANUAL_META } from '../_config';
import { WORKER } from '../_content/worker';

export const metadata = {
  title: `${WORKER.meta.title} — ${MANUAL_META.title}`,
  description: WORKER.meta.subtitle,
};

export default function WorkerManual() {
  const W = WORKER;

  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · {MANUAL_META.lastUpdated}</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="근로자 매뉴얼 PDF" />
        </div>
      </header>

      <div className="manual-container">
        <header className="manual-page-header">
          <div className="manual-page-eyebrow"><RoleBadge role="worker" /></div>
          <h1 className="manual-page-title">{W.meta.title}</h1>
          <p className="manual-page-lead">{W.meta.welcome}</p>
        </header>

        {/* ─── Ch.1 환영합니다 ─── */}
        <section className="manual-chapter" id={W.welcome.num}>
          <div className="manual-chapter-num">CHAPTER {W.welcome.num}</div>
          <h2 className="manual-chapter-title">{W.welcome.title}</h2>
          <p className="manual-chapter-lead">{W.welcome.lead}</p>
          <p style={{ fontSize: 17, color: '#334155', lineHeight: 1.7, marginBottom: 24, maxWidth: 720 }}>{W.welcome.intro}</p>
          <div className="step-list">
            {W.welcome.canDo.map((c, i) => (
              <StepCard key={c.title} n={`✓`} title={c.title} body={c.body} />
            ))}
          </div>
        </section>

        <div className="manual-divider" />

        {/* ─── Ch.2 처음 로그인하기 ─── */}
        <section className="manual-chapter" id={W.login.num}>
          <div className="manual-chapter-num">CHAPTER {W.login.num}</div>
          <h2 className="manual-chapter-title">{W.login.title}</h2>
          <p className="manual-chapter-lead">{W.login.lead}</p>
          <div className="step-list">
            {W.login.steps.map((s, i) => (
              <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
            ))}
          </div>
          <TipBox title={W.login.tip.title}>{W.login.tip.body}</TipBox>
          <WarnBox title={W.login.warn.title}>{W.login.warn.body}</WarnBox>

          {/* 다음 단계 안내 */}
          <Link href={`#${W.attendance.num}`} className="next-step" style={{ textDecoration: 'none' }}>
            <div>
              <div className="next-step-label">다음 단계</div>
              <div className="next-step-title">{W.nextSteps[0].desc}</div>
            </div>
            <span className="next-step-arrow" aria-hidden>→</span>
          </Link>
        </section>

        <div className="manual-divider" />

        {/* ─── Ch.3 출근 도장 찍기 ─── */}
        <section className="manual-chapter" id={W.attendance.num}>
          <div className="manual-chapter-num">CHAPTER {W.attendance.num}</div>
          <h2 className="manual-chapter-title">{W.attendance.title}</h2>
          <p className="manual-chapter-lead">{W.attendance.lead}</p>
          <div className="step-list">
            {W.attendance.steps.map((s, i) => (
              <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
            ))}
          </div>
          <TipBox title={W.attendance.tip.title}>{W.attendance.tip.body}</TipBox>
          <WarnBox title={W.attendance.warn.title}>{W.attendance.warn.body}</WarnBox>

          <Link href={`#${W.leave.num}`} className="next-step" style={{ textDecoration: 'none' }}>
            <div>
              <div className="next-step-label">다음 단계</div>
              <div className="next-step-title">{W.nextSteps[1].desc}</div>
            </div>
            <span className="next-step-arrow" aria-hidden>→</span>
          </Link>
        </section>

        <div className="manual-divider" />

        {/* ─── Ch.4 휴가 신청하기 ─── */}
        <section className="manual-chapter" id={W.leave.num}>
          <div className="manual-chapter-num">CHAPTER {W.leave.num}</div>
          <h2 className="manual-chapter-title">{W.leave.title}</h2>
          <p className="manual-chapter-lead">{W.leave.lead}</p>
          <div className="step-list">
            {W.leave.steps.map((s, i) => (
              <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} />
            ))}
          </div>
          <TipBox title={W.leave.tip.title}>{W.leave.tip.body}</TipBox>
          <WarnBox title={W.leave.warn.title}>{W.leave.warn.body}</WarnBox>
        </section>

        <div className="manual-divider" />

        {/* ─── Ch.5 자주 묻는 질문 ─── */}
        <section className="manual-chapter" id="faq">
          <div className="manual-chapter-num">CHAPTER 05</div>
          <h2 className="manual-chapter-title">자주 묻는 질문</h2>
          <p className="manual-chapter-lead">현장에서 자주 받는 질문들을 모았습니다. 더 궁금한 내용이 있으시면 회사 관리자에게 언제든지 말씀해 주세요.</p>
          <div className="faq-list">
            {W.faqs.map((f) => (
              <FaqItem key={f.q} q={f.q}>
                <p>{f.a}</p>
              </FaqItem>
            ))}
          </div>
        </section>

        {/* 추가 챕터 안내 (다음 턴에 추가될 챕터들) */}
        <div className="manual-divider" />
        <section className="manual-chapter">
          <div className="manual-chapter-num">CHAPTER 06+</div>
          <h2 className="manual-chapter-title">계속 추가됩니다</h2>
          <p className="manual-chapter-lead">
            안전 일일점검·TBM 서명·민원 처리·실적 입력·내 프로필·추천경로(기동반)·SOS 등 나머지 챕터가 곧 이어집니다.
            지금 보실 수 있는 첫 4 챕터로 출퇴근과 휴가까지 막힘없이 사용하실 수 있습니다.
          </p>
        </section>

        <footer style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <p style={{ marginBottom: 8 }}><strong style={{ color: '#0f172a' }}>{MANUAL_META.brand}</strong> · {MANUAL_META.domain}</p>
          <p>{W.meta.title} · {MANUAL_META.version} · {MANUAL_META.lastUpdated}</p>
          <p style={{ marginTop: 12 }}><Link href="/manual">← 매뉴얼 메인으로</Link></p>
        </footer>
      </div>
    </main>
  );
}
