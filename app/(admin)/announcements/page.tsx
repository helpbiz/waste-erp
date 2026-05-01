/**
 * 공지사항 관리 페이지 — 관리자(SUPER/CONTRACTOR/INTERNAL)만 접근.
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import AnnouncementsClient from './_announcements-client';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/announcements');
  /* MUNI_ADMIN 도 공지 작성 가능 (2026-05-02 사용자 요구사항) */
  const POSTERS = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'];
  if (!POSTERS.includes(session.role)) redirect('/dashboard');

  return <AnnouncementsClient session={{ name: session.name, role: session.role }} />;
}
