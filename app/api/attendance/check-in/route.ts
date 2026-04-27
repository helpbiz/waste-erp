import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { todayKstDate } from '@/lib/dates';

export const runtime = 'nodejs';

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoneId: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (session.role !== 'WORKER') {
    /* 관리자가 대신 등록하는 케이스는 별도 엔드포인트(추후 /admin/check-in)에서 처리 */
    return NextResponse.json({ error: 'workers_only' }, { status: 403 });
  }
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor_assigned' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { lat, lng, zoneId } = parsed.data;
  if (!isInsideKorea(lat, lng)) {
    return NextResponse.json(
      { error: 'gps_out_of_range', message: '국내 위경도 박스 밖의 좌표입니다.' },
      { status: 422 }
    );
  }

  const today = todayKstDate();
  const workerId = BigInt(session.userId);
  const contractorId = BigInt(session.contractorId);

  const existing = await prisma.attendanceRecord.findUnique({
    where: { workerId_workDate: { workerId, workDate: today } },
  });
  if (existing && existing.checkInTime) {
    return NextResponse.json(
      { error: 'already_checked_in', recordId: existing.id.toString() },
      { status: 409 }
    );
  }

  const now = new Date();
  const record = await prisma.attendanceRecord.upsert({
    where: { workerId_workDate: { workerId, workDate: today } },
    create: {
      workerId,
      contractorId,
      workDate: today,
      checkInTime: now,
      checkInLat: lat,
      checkInLng: lng,
      workType: 'NORMAL',
      zoneId: zoneId !== undefined ? BigInt(zoneId) : null,
      status: 'PENDING',
    },
    update: {
      checkInTime: now,
      checkInLat: lat,
      checkInLng: lng,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: workerId,
      actorRole: session.role,
      action: 'ATTENDANCE_CHECK_IN',
      resourceType: 'attendance_record',
      resourceId: record.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      metadata: { lat, lng, zoneId: zoneId ?? null } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    record: {
      id: record.id.toString(),
      checkInTime: record.checkInTime?.toISOString() ?? null,
      workType: record.workType,
      status: record.status,
    },
  });
}
