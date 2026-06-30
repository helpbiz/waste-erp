/**
 * GET /api/safety/weather-notices/print?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 날짜 범위 날씨관리대장 출력용 — 공지 + 근로자 기록 일괄 조회
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

const ALERT_LABEL: Record<string, string> = {
  HEATWAVE: '폭염', COLDWAVE: '한파', TYPHOON: '태풍', STORM: '강풍·폭우', OTHER: '기타',
};

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ notices: [] });

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam   = url.searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'from_to_required' }, { status: 400 });
  }

  const from = new Date(fromParam + 'T00:00:00');
  const to   = new Date(toParam   + 'T00:00:00');
  to.setDate(to.getDate() + 1); // to는 포함

  const contractorId = BigInt(session.contractorId);

  const notices = await prisma.weatherSafetyNotice.findMany({
    where: {
      contractorId,
      noticeDate: { gte: from, lt: to },
    },
    orderBy: [{ noticeDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      creator: { select: { name: true } },
      photos: {
        orderBy: { uploadedAt: 'asc' },
        include: { worker: { select: { name: true, employeeNo: true } } },
      },
    },
  });

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    notices: notices.map((n) => ({
      id: n.id.toString(),
      noticeDate: n.noticeDate.toISOString().slice(0, 10),
      alertType: n.alertType,
      alertLabel: ALERT_LABEL[n.alertType] ?? n.alertType,
      title: n.title,
      content: n.content ?? null,
      noticePhoto: n.noticePhoto ?? null,
      createdBy: n.creator.name,
      photoCount: n.photos.length,
      photos: n.photos.map((p) => ({
        id: p.id.toString(),
        workerName: p.worker.name,
        employeeNo: p.worker.employeeNo ?? null,
        photoData:   p.photoData,
        uploadedAt:  p.uploadedAt.toISOString(),
        recordTime:  p.recordTime  ?? null,
        feelsLike:   p.feelsLike   ?? null,
        actionTaken: p.actionTaken ?? null,
        managerName: p.managerName ?? null,
      })),
    })),
  });
}
