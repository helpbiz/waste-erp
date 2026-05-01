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
  const ADMIN = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'];
  if (!ADMIN.includes(session.role)) redirect('/dashboard');

  return <AnnouncementsClient session={{ name: session.name, role: session.role }} />;
}
