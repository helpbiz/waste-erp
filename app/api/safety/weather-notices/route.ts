/**
 * GET  /api/safety/weather-notices?date=YYYY-MM-DD  — 공지 목록
 * POST /api/safety/weather-notices                  — 공지 등록 (관리자 또는 isNoticeManager 근로자)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession, type SessionPayload } from '@/lib/auth';
import { todayKstDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

async function canManageNotice(session: SessionPayload): Promise<boolean> {
  if (isManager(session.role)) return true;
  if (session.role === 'WORKER' && session.contractorId) {
    const u = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isNoticeManager: true } });
    return u?.isNoticeManager === true;
  }
  return false;
}

const ALERT_LABELS: Record<string, string> = {
  HEATWAVE: '폭염', COLDWAVE: '한파', TYPHOON: '태풍', STORM: '강풍·폭우', OTHER: '기타',
};

const PostBody = z.object({
  alertType: z.enum(['HEATWAVE', 'COLDWAVE', 'TYPHOON', 'STORM', 'OTHER']).default('HEATWAVE'),
  title: z.string().trim().min(2).max(100),
  content: z.string().trim().max(2000).optional(),
  noticeDate: z.string().optional(),
  noticePhoto: z.string().max(1_200_000, '사진 크기가 너무 큽니다.').optional().nullable(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ notices: [] });

  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date');
  const contractorId = BigInt(session.contractorId);

  const where: Record<string, unknown> = { contractorId };
  if (dateParam) {
    const d = new Date(dateParam + 'T00:00:00');
    const next = new Date(d); next.setDate(next.getDate() + 1);
    where.noticeDate = { gte: d, lt: next };
  }

  const notices = await prisma.weatherSafetyNotice.findMany({
    where,
    orderBy: [{ noticeDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      creator: { select: { name: true } },
      _count: { select: { photos: true } },
      ...(session.role === 'WORKER' ? {
        photos: { where: { workerId: BigInt(session.userId) }, select: { id: true }, take: 1 },
      } : {}),
    },
  });

  return NextResponse.json({
    notices: notices.map((n) => {
      const myPhoto = session.role === 'WORKER' && 'photos' in n && Array.isArray(n.photos) && n.photos.length > 0
        ? { id: (n.photos as Array<{ id: bigint }>)[0].id.toString() }
        : null;
      return {
        id: n.id.toString(),
        noticeDate: n.noticeDate.toISOString().slice(0, 10),
        alertType: n.alertType,
        alertLabel: ALERT_LABELS[n.alertType] ?? n.alertType,
        title: n.title,
        content: n.content ?? null,
        noticePhoto: n.noticePhoto ?? null,
        createdBy: n.creator.name,
        createdAt: n.createdAt.toISOString(),
        photoCount: n._count.photos,
        myPhoto,
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!await canManageNotice(session)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const noticeDate = b.noticeDate ? new Date(b.noticeDate + 'T00:00:00') : todayKstDate();

  const notice = await prisma.weatherSafetyNotice.create({
    data: {
      contractorId: BigInt(session.contractorId),
      noticeDate,
      alertType: b.alertType,
      title: b.title,
      content: b.content ?? null,
      noticePhoto: b.noticePhoto ?? null,
      createdBy: BigInt(session.userId),
    },
  });

  return NextResponse.json({ ok: true, id: notice.id.toString() }, { status: 201 });
}
