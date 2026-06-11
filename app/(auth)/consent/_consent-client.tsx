'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibleConfirmDialog from '@/components/ui/AccessibleConfirmDialog';

export default function ConsentClient({
  userName,
  role,
  next,
}: {
  userName: string;
  role: string;
  next: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);

  async function onAgree() {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error ?? '동의 등록에 실패했습니다.');
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  /* 거부 → AccessibleConfirmDialog 로 명확한 다이얼로그 (P0-6).
     window.confirm 은 모바일에서 OS 다이얼로그라 디자인/대비 통제 불가. */
  async function doReject() {
    setConfirmingReject(false);
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <main
      className="min-h-screen w-full flex items-start sm:items-center justify-center px-4 py-8"
      style={{
        background:
          'radial-gradient(circle at 20% 0%, #0e7490 0%, #164e63 45%, #0f172a 100%)',
      }}
    >
      <div className="w-full max-w-[640px]">
        {/* 헤더 */}
        <div className="text-center mb-6">
          {/* 🔒 LOGO LOCK — 사용자 명시 요청 2026-04-29.
              이 로고는 변경 금지. src 경로 / alt 텍스트 / 사이즈 절대 수정 X.
              동일 자산: app/(auth)/login/page.tsx 도 동일하게 고정 유지. */}
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-horizontal-dark.svg"
              alt="공비랩 Clean ERP"
              width={240}
              height={102}
              className="block w-[240px] h-auto drop-shadow-lg"
            />
          </div>
          <h1 className="text-base font-extrabold text-white">개인정보 수집·이용 동의</h1>
          <p className="text-[0.75rem] font-bold text-white/70 mt-1">
            {userName} 님 ({role}) · 시스템 이용을 위해 아래 사항에 동의해 주세요
          </p>
        </div>

        {/* 동의 본문 카드 */}
        <div className="bg-surface rounded-xl shadow-card border border-line">
          <div className="px-5 py-4 border-b-2 border-line bg-surface-soft rounded-t-xl">
            <div className="text-xs font-extrabold text-ink tracking-wide">📋 안내사항 (개인정보보호법 §15·22 / 근로기준법 §42 / 산업안전보건법 §165)</div>
          </div>

          <div tabIndex={0} role="region" aria-label="개인정보 처리방침 본문" className="px-5 py-4 max-h-[55vh] overflow-y-auto text-[0.78125rem] leading-relaxed text-ink space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:ring-2 focus:ring-accent">
            <Section title="1. 수집하는 개인정보 항목">
              <ul className="list-disc pl-5 space-y-0.5">
                <li><b>필수</b>: 성명, 생년월일, 성별, 휴대전화번호, 주소, 사번, 직책, 부서, 입·퇴사일</li>
                <li><b>업무 수행</b>: 출퇴근 GPS 위치, 차량 운행 경로, 민원 처리 사진, 안전점검 서명</li>
                <li><b>보호자</b>: 비상연락처(이름·전화번호) — 산업재해 발생 시 통지용</li>
                <li><b>금융</b>: 급여 지급용 은행 계좌번호 (AES-256 암호화 저장)</li>
              </ul>
            </Section>

            <Section title="2. 수집·이용 목적">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>근로자 신분 확인, 근태·휴가·급여 관리</li>
                <li>차량 운행일지 및 작업 이력 관리</li>
                <li>산업안전보건 의무 이행 (TBM 서명, 일일 점검, 사고 보고)</li>
                <li>지자체 위탁 계약상의 실적 보고 및 통계 작성</li>
                <li>민원 처리·고객 응대를 위한 GPS 위치 및 현장 사진 활용</li>
              </ul>
            </Section>

            <Section title="3. 보유 및 이용 기간">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>재직 기간 + 퇴직 후 <b className="text-danger">5년</b> (산업안전보건법 §165, 근로기준법 §42)</li>
                <li>감사 로그(audit_logs): <b>5년</b> 보존</li>
                <li>민원 사진·GPS: 처리 완료 후 <b>3년</b></li>
                <li>위 기간 경과 후 즉시 안전 파기 (전자적 기록은 복구 불능 방식)</li>
              </ul>
            </Section>

            <Section title="4. 제3자 제공">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>원칙적으로 제3자에게 제공하지 않습니다.</li>
                <li>다만 다음의 경우 법령에 따라 제공될 수 있습니다:
                  <ul className="list-[circle] pl-5 mt-1 text-ink-muted">
                    <li>지자체(시·구청) — 위탁계약 이행 보고용 (성명·근태·실적)</li>
                    <li>고용노동부·근로복지공단 — 산업재해 신고 시</li>
                    <li>수사기관 — 영장 또는 법령상 의무 이행 시</li>
                  </ul>
                </li>
              </ul>
            </Section>

            <Section title="5. 보안 조치">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>비밀번호 bcrypt cost 12 일방향 해시</li>
                <li>주민등록번호·계좌번호 등 민감정보 AES-256-GCM 암호화 (KMS 관리)</li>
                <li>HTTPS 전송, JWT 세션 8시간 후 자동 만료</li>
                <li>접근 로그 5년 보관, 권한 분리(RBAC 5단계)</li>
              </ul>
            </Section>

            <Section title="6. 동의 거부의 권리 및 거부 시 불이익">
              <p>
                정보주체는 본 동의를 <b>거부할 권리</b>가 있습니다. 다만 본 동의는 근로계약 이행 및
                법령상 의무(근로기준법, 산업안전보건법) 이행을 위한 <b className="text-danger">필수 정보</b>이므로
                <b className="text-danger"> 동의하지 않을 경우 시스템을 사용할 수 없습니다.</b>
              </p>
            </Section>

            <Section title="7. 정보주체의 권리">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>본인 정보 열람·정정·삭제 요청권</li>
                <li>처리정지 요청권</li>
                <li>동의 철회권 (단, 철회 시 시스템 사용 중단)</li>
                <li>문의: 사용자관리 메뉴 → 본인 프로필 또는 회사 개인정보보호 책임자</li>
              </ul>
            </Section>
          </div>

          {/* 동의 체크박스 + 버튼 */}
          <div className="px-5 py-4 border-t-2 border-line bg-surface-soft rounded-b-xl space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-accent cursor-pointer"
              />
              <span className="text-sm font-extrabold text-ink leading-snug">
                위 안내사항을 모두 읽고 이해하였으며,{' '}
                <span className="text-danger underline underline-offset-2">개인정보 수집·이용에 동의합니다.</span>
              </span>
            </label>

            {error && (
              <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            {/* AAA 액션 (P0-6): 본문 버튼 18px / min-h-14, 거부 버튼 별도 강조 outline.
                이전: 12px slate-600 hover-only — 시니어 발견 불가. */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <button
                type="button"
                onClick={onAgree}
                disabled={!agreed || busy}
                className="flex-1 min-h-14 px-5 py-3 rounded-lg bg-accent text-white text-lg font-extrabold hover:bg-cyan-800 active:bg-cyan-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
              >
                {busy ? '등록 중…' : '동의하고 시작하기'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReject(true)}
                disabled={busy}
                className="min-h-14 px-5 py-3 rounded-lg bg-white border-2 border-line-strong text-base font-extrabold text-ink-mid hover:border-danger hover:text-danger active:bg-surface-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                동의 안 함 / 로그아웃
              </button>
            </div>

            <p className="text-sm font-medium text-ink-faint text-center mt-2">
              동의 시각·IP·User-Agent는 감사로그에 기록되며 5년 보존됩니다.
            </p>
          </div>
        </div>
      </div>

      <AccessibleConfirmDialog
        open={confirmingReject}
        tone="destructive"
        title="동의하지 않으시겠습니까?"
        message="동의하지 않으면 시스템을 사용할 수 없으며, 자동으로 로그아웃됩니다."
        confirmLabel="로그아웃"
        cancelLabel="다시 검토"
        onConfirm={doReject}
        onCancel={() => setConfirmingReject(false)}
      />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-accent mb-1 tracking-wide">{title}</div>
      <div className="text-[0.78125rem] text-ink">{children}</div>
    </div>
  );
}
