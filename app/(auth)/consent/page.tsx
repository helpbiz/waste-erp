/**
 * /consent — 개인정보 수집·이용 동의 페이지
 *
 * - 로그인 직후 user.privacyConsentAt이 null이면 미들웨어가 강제 진입
 * - 미동의 사용자는 앱의 어떤 기능도 사용 불가 (logout 가능)
 * - 동의 시 JWT 재발급 + DB 기록 → 원래 가려던 next로 리다이렉트
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import ConsentClient from './_consent-client';

export const dynamic = 'force-dynamic';

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await readSession();
  if (!session) redirect('/login');

  /* role 기반 기본 랜딩 — WORKER는 워커앱, 그 외는 민원관리 */
  const defaultLanding = session.role === 'WORKER' ? '/worker' : '/complaints';

  /* 이미 동의한 사용자는 원래 경로로 보냄 */
  if (session.consentedAt) {
    redirect(safeNext(searchParams.next, defaultLanding));
  }

  return (
    <ConsentClient
      userName={session.name}
      role={session.role}
      next={safeNext(searchParams.next, defaultLanding)}
    />
  );
}

function safeNext(next: string | undefined, fallback: string): string {
  if (!next) return fallback;
  /* 외부 URL / open redirect 방지 */
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next === '/consent') return fallback;
  return next;
}
