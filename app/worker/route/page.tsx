// 기동반(RAPID) 전용 — 미처리 민원 추천경로 모바일 화면
// Plan: /live-vehicles 추천경로 기능을 워커앱 모바일 사이즈에 simplified UI 로 제공.
// 권한: WORKER + position.code === 'RAPID'.
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import WorkerRouteClient from './_worker-route-client';

export const dynamic = 'force-dynamic';

export default async function WorkerRoutePage() {
  const session = (await readSession())!;
  /* layout이 이미 WORKER 보장. 여기서는 position 체크만 추가 */
  const me = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { position: { select: { code: true, label: true } } },
  });
  if (me?.position?.code !== 'RAPID') {
    /* 기동반 외 워커는 홈으로 */
    redirect('/worker');
  }
  return <WorkerRouteClient positionLabel={me.position.label} />;
}
