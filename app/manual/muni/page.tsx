import Link from 'next/link';
import '../manual.css';
import PrintButton from '../_components/PrintButton';
import RoleBadge from '../_components/RoleBadge';
import { MANUAL_META } from '../_config';

export const metadata = {
  title: `지자체관리자 사용설명서 — ${MANUAL_META.title}`,
  description: '시·군·구 환경과 직원을 위한 CleanERP 사용 안내',
};

/* 지자체관리자 매뉴얼 — 다음 턴에 풀 콘텐츠 빌드.
   인벤토리: 9 화면 (대시보드·민원·안전·근태·차량·실적·실시간차량·통계보고서·공지사항).
   READ-ONLY + 권한매트릭스 의존 + 공지 작성 가능. */

export default function MuniManual() {
  return (
    <main className="manual">
      <header className="manual-toolbar">
        <div className="manual-toolbar-brand">
          <Link href="/manual">{MANUAL_META.title}</Link>
          <span className="manual-toolbar-version">{MANUAL_META.version} · 작성 중</span>
        </div>
        <div className="manual-toolbar-actions">
          <PrintButton label="지자체관리자 매뉴얼 PDF" />
        </div>
      </header>

      <div className="manual-container">
        <header className="manual-page-header">
          <div className="manual-page-eyebrow"><RoleBadge role="muni" /></div>
          <h1 className="manual-page-title">지자체관리자 사용설명서</h1>
          <p className="manual-page-lead">시·군·구 환경과에서 관할 위탁업체의 운영 현황을 모니터링하고 월간 보고서를 받는 방법을 안내합니다.</p>
        </header>

        <section className="manual-chapter">
          <div className="manual-chapter-num">작성 진행 중</div>
          <h2 className="manual-chapter-title">곧 만나뵙겠습니다</h2>
          <p className="manual-chapter-lead">
            지자체관리자 매뉴얼은 9개 화면(메인 대시보드·민원·산업안전보건·근태·차량·실적·실시간 차량조회·통계 보고서·공지사항)과 권한 매트릭스 3종(표준/모니터링 전용/전체 공개)을 다룹니다.
            근로자·회사관리자 매뉴얼 작성 후 이어집니다.
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
