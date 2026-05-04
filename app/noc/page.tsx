/**
 * NOC (Network Operation Center) 대시보드 — 56" 4K / 50" 디스플레이용 풀스크린 관제 화면.
 *
 * 권한: SUPER_ADMIN 전용 (글로벌 관제). 회사·지자체 관제는 별도 /dashboard/wall 사용.
 * 무인 운영: Chromium kiosk + autostart, 30s 자동 폴링.
 *
 * Design Ref: docs/04-report/2026-04-29-session-log.md NOC 설계 (Plan + frontend-architect).
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import NocClient from './_noc-client';

export const dynamic = 'force-dynamic';

export default async function NocPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/noc');
  if (session.role !== 'SUPER_ADMIN') redirect('/');

  return <NocClient session={{ name: session.name, role: session.role }} />;
}
