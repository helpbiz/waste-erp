/**
 * POST /api/cron/demo-cleanup — 만료된 딜러 데모 Contractor/Municipality 정리
 *
 * 외부 cron (K8s CronJob 또는 GitHub Actions)에서 매일 호출 권장.
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://www.cleanerp.kr/api/cron/demo-cleanup
 *
 * Body (optional): { dryRun?: boolean } — 기본 dryRun=false
 *
 * ⚠️ 최초 프로덕션 스케줄 등록 전, 반드시 스테이징에서 dryRun=false 리허설을 한 번
 * 돌려 lib/demo/table-order.ts 의 삭제 순서가 실제 FK 제약과 충돌 없는지 확인할 것
 * (Design §3.3 — 실패해도 트랜잭션 롤백이라 데이터 손상은 없으나, 정리 자체가 안 됨).
 */
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { cleanupExpiredDemos } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const result = await cleanupExpiredDemos(dryRun);

  return NextResponse.json({ ok: true, ...result });
}
