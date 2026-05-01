import Link from 'next/link';
import '../manual.css';
import PrintButton from '../_components/PrintButton';
import RoleBadge from '../_components/RoleBadge';
import { MANUAL_META } from '../_config';

export const metadata = {
  title: `회사관리자 사용설명서 — ${MANUAL_META.title}`,
  description: '대표·팀장·안전관리자를 위한 CleanERP 사용 안내',
};

/* 회사관리자 매뉴얼 — 다음 턴에 풀 콘텐츠 빌드.
   인벤토리: 12 메뉴 카테고리 (대시보드·민원·근태·차량·실적·안전·보건·사용자·원가급여·보고서·공지·대형폐기물).
   현재는 스텁 — 사용자가 모든 라우트가 동작하는지 확인 가능. */

export default function ContractorManual() {
  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · 작성 중</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="회사관리자 매뉴얼 PDF" />
        </div>
      </header>

      <div className="manual-container">
        <header className="manual-page-header">
          <div className="manual-page-eyebrow"><RoleBadge role="contractor" /></div>
          <h1 className="manual-page-title">회사관리자 사용설명서</h1>
          <p className="manual-page-lead">대표·팀장·안전관리자가 직원·차량·결재·민원·실적·안전을 한 시스템에서 관리하는 방법을 정리합니다.</p>
        </header>

        <section className="manual-chapter">
          <div className="manual-chapter-num">작성 진행 중</div>
          <h2 className="manual-chapter-title">곧 만나뵙겠습니다</h2>
          <p className="manual-chapter-lead">
            회사관리자 매뉴얼은 12개 메뉴 카테고리(대시보드·민원·근태·차량·실시간 차량·산업안전보건·보건기록·사용자·원가급여·보고서·공지사항·대형폐기물 자동연동)를 빠짐없이 다룰 예정입니다.
            근로자 매뉴얼이 먼저 정리되면 이어서 빌드됩니다.
          </p>
          <Link href="/manual" className="next-step" style={{ textDecoration: 'none', marginTop: 24 }}>
            <div>
              <div className="next-step-label">매뉴얼 메인</div>
              <div className="next-step-title">다른 역할 매뉴얼 보기</div>
            </div>
            <span className="next-step-arrow" aria-hidden>→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
