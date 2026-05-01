// Design Ref: docs/02-design/mobile-ux-overhaul.md §9.1
// Plan SC: Wave 1 — max-w-480 제거 (100vw), AppBar + Drawer + safe-area
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasFeature } from '@/lib/features';
import { WorkerLayoutShell } from './_layout-shell';

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'WORKER') redirect('/dashboard'); // 관리자 차단

  /* 직책 RAPID(기동반)만 추천경로 메뉴 노출 — Drawer에서 표시 */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { position: { select: { code: true } } },
  });
  /* 회사별 기능 권한 — recommendedRoute OFF 면 RAPID 워커여도 메뉴 숨김 */
  const positionRapid = me?.position?.code === 'RAPID';
  const featureOn = await hasFeature(session.contractorId, 'recommendedRoute');
  const isRapid = positionRapid && featureOn;

  return (
    <WorkerLayoutShell
      user={{ name: session.name, userId: session.userId, role: session.role }}
      isRapid={isRapid}
    >
      {children}
    </WorkerLayoutShell>
  );
}
