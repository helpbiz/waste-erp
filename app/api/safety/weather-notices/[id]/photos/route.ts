/**
 * GET  /api/safety/weather-notices/[id]/photos — 기록 목록 (관리자)
 * POST /api/safety/weather-notices/[id]/photos — 기록 저장 (근로자)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { parseId } from '@/lib/ids';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

const PostBody = z.object({
  photoData:   z.string().max(400_000, '사진 크기가 너무 큽니다. 더 작은 사진을 사용해 주세요.').optional().nullable(),
  recordTime:  z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  feelsLike:   z.number().min(-50).max(60).optional().nullable(),
  actionTaken: z.string().trim().max(1000).optional().nullable(),
  managerName: z.string().trim().max(50).optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const noticeId = parseId(params.id);
  if (noticeId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const notice = await prisma.weatherSafetyNotice.findUnique({
    where: { id: noticeId },
    select: { id: true, title: true, noticeDate: true, contractorId: true, alertType: true },
  });
  if (!notice) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (session.contractorId && notice.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const photos = await prisma.weatherSafetyPhoto.findMany({
    where: { noticeId },
    orderBy: { uploadedAt: 'asc' },
    include: { worker: { select: { name: true, employeeNo: true } } },
  });

  return NextResponse.json({
    notice: {
      id: notice.id.toString(),
      title: notice.title,
      alertType: notice.alertType,
      noticeDate: notice.noticeDate.toISOString().slice(0, 10),
    },
    photos: photos.map((p) => ({
      id: p.id.toString(),
      workerName: p.worker.name,
      employeeNo: p.worker.employeeNo ?? null,
      photoData: p.photoData,
      uploadedAt: p.uploadedAt.toISOString(),
      recordTime:  p.recordTime  ?? null,
      feelsLike:   p.feelsLike   ?? null,
      actionTaken: p.actionTaken ?? null,
      managerName: p.managerName ?? null,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'workers_only' }, { status: 403 });

  const noticeId = parseId(params.id);
  if (noticeId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const notice = await prisma.weatherSafetyNotice.findUnique({
    where: { id: noticeId },
    select: { id: true, contractorId: true },
  });
  if (!notice) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (session.contractorId && notice.contractorId.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const photoErr = parsed.error.flatten().fieldErrors.photoData?.[0];
    return NextResponse.json(
      { error: 'invalid_request', message: photoErr ?? '입력값이 올바르지 않습니다.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { photoData, recordTime, feelsLike, actionTaken, managerName } = parsed.data;
  const now = new Date();

  await prisma.weatherSafetyPhoto.upsert({
    where: { noticeId_workerId: { noticeId, workerId: BigInt(session.userId) } },
    create: {
      noticeId, workerId: BigInt(session.userId),
      photoData: photoData ?? '',
      recordTime: recordTime ?? null,
      feelsLike:  feelsLike ?? null,
      actionTaken: actionTaken ?? null,
      managerName: managerName ?? null,
    },
    update: {
      ...(photoData ? { photoData } : {}),
      recordTime:  recordTime  ?? null,
      feelsLike:   feelsLike   ?? null,
      actionTaken: actionTaken ?? null,
      managerName: managerName ?? null,
      uploadedAt: now,
    },
  });

  return NextResponse.json({ ok: true });
}
