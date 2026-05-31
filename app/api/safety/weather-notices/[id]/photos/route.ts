/**
 * GET  /api/safety/weather-notices/[id]/photos — 사진 목록 (관리자)
 * POST /api/safety/weather-notices/[id]/photos — 사진 업로드 (근로자, 1인 1장)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { parseId } from '@/lib/ids';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

const PostBody = z.object({
  photoData: z.string().min(100).max(300_000), // base64 Data URL
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const noticeId = parseId(params.id);
  if (noticeId == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const notice = await prisma.weatherSafetyNotice.findUnique({
    where: { id: noticeId },
    select: { id: true, title: true, noticeDate: true, contractorId: true },
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
      noticeDate: notice.noticeDate.toISOString().slice(0, 10),
    },
    photos: photos.map((p) => ({
      id: p.id.toString(),
      workerName: p.worker.name,
      employeeNo: p.worker.employeeNo ?? null,
      photoData: p.photoData,
      uploadedAt: p.uploadedAt.toISOString(),
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
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await prisma.weatherSafetyPhoto.upsert({
    where: { noticeId_workerId: { noticeId, workerId: BigInt(session.userId) } },
    create: { noticeId, workerId: BigInt(session.userId), photoData: parsed.data.photoData },
    update: { photoData: parsed.data.photoData, uploadedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
