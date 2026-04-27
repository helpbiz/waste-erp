/**
 * GET /api/leave-requests/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&type=&status=&workerId=&departmentId=
 *  - 기간 내 휴가 통계 (가시범위 적용)
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { collectLeaveStats } from '@/lib/leave-stats';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'invalid_range', hint: 'from / to (YYYY-MM-DD) 필요' }, { status: 400 });
  }
  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T23:59:59Z');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
  }

  const stats = await collectLeaveStats(session, { from, to }, {
    requestType: url.searchParams.get('type') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    workerId: url.searchParams.get('workerId') ?? undefined,
    departmentId: url.searchParams.get('departmentId') ?? undefined,
  });

  return NextResponse.json(stats);
}
