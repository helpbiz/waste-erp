/**
 * GET /api/tbm/education-stats — 교육시간현황 (관리자 전용)
 * Query: year=2026 (기본: 당해 연도)
 * 각 근로자의 TBM 참석 횟수 및 추정 교육시간(횟수 × 10분) 반환
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }

  const contractorId = BigInt(session.contractorId);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  // 해당 연도 TBM 서명 전체 조회
  const signatures = await prisma.tbmSignature.findMany({
    where: {
      session: {
        contractorId,
        sessionDate: { gte: from, lt: to },
      },
    },
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
          position: { select: { label: true } },
        },
      },
      session: { select: { sessionDate: true } },
    },
  });

  // per-worker 집계
  const map = new Map<string, {
    id: string; name: string; employeeNo: string | null;
    department: string | null; position: string | null;
    count: number; minutesEstimated: number;
    lastDate: string;
  }>();

  for (const sig of signatures) {
    const wid = sig.worker.id.toString();
    const existing = map.get(wid);
    const date = sig.session.sessionDate.toISOString().slice(0, 10);
    if (existing) {
      existing.count += 1;
      existing.minutesEstimated += 10;
      if (date > existing.lastDate) existing.lastDate = date;
    } else {
      map.set(wid, {
        id: wid,
        name: sig.worker.name,
        employeeNo: sig.worker.employeeNo ?? null,
        department: sig.worker.department?.name ?? null,
        position: sig.worker.position?.label ?? null,
        count: 1,
        minutesEstimated: 10,
        lastDate: date,
      });
    }
  }

  const workers = Array.from(map.values()).sort((a, b) => b.count - a.count);

  // 전체 근로자 수 (분모용)
  const totalWorkers = await prisma.user.count({
    where: { contractorId, role: 'WORKER', status: 'ACTIVE' },
  });

  return NextResponse.json({
    year,
    totalWorkers,
    participantCount: workers.length,
    totalSessions: await prisma.tbmSession.count({
      where: { contractorId, sessionDate: { gte: from, lt: to } },
    }),
    workers,
  });
}
