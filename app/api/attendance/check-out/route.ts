import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { todayKstDate } from '@/lib/dates';
import { writeAudit } from '@/lib/audit';
import { hasFeature } from '@/lib/features';

export const runtime = 'nodejs';

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'workers_only' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  /* P0-residual: PIPA — GPS 라운딩 */
  const rawLat = roundCoord(parsed.data.lat) as number;
  const rawLng = roundCoord(parsed.data.lng) as number;
  if (!isInsideKorea(rawLat, rawLng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  /* 회사별 기능 권한 — attendanceGps OFF 면 좌표 저장 skip */
  const gpsOn = session.contractorId ? await hasFeature(session.contractorId, 'attendanceGps') : false;
  const lat: number | null = gpsOn ? rawLat : null;
  const lng: number | null = gpsOn ? rawLng : null;

  const today = todayKstDate();
  const workerId = BigInt(session.userId);

  /* 출퇴근 제한 규칙 검증 (퇴근) */
  if (session.contractorId) {
    const contractorId = BigInt(session.contractorId);
    const worker = await prisma.user.findUnique({ where: { id: workerId }, select: { departmentId: true } });
    const restrictions = await prisma.punchRestriction.findMany({
      where: {
        contractorId,
        active: true,
        OR: [{ departmentId: null }, { departmentId: worker?.departmentId ?? null }],
      },
    });
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstHHMM = `${String(kstNow.getUTCHours()).padStart(2, '0')}:${String(kstNow.getUTCMinutes()).padStart(2, '0')}`;
    /* 퇴근은 장소 제한 없이 — 시간대 규칙만 적용 */
    for (const r of restrictions) {
      if (r.checkOutFrom && kstHHMM < r.checkOutFrom) {
        return NextResponse.json({ error: 'punch_too_early', allowFrom: r.checkOutFrom, rule: r.name }, { status: 403 });
      }
      if (r.checkOutUntil && kstHHMM > r.checkOutUntil) {
        return NextResponse.json({ error: 'punch_too_late', allowUntil: r.checkOutUntil, rule: r.name }, { status: 403 });
      }
    }
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { workerId_workDate: { workerId, workDate: today } },
  });
  if (!record || !record.checkInTime) {
    return NextResponse.json({ error: 'not_checked_in' }, { status: 400 });
  }
  if (record.checkOutTime) {
    return NextResponse.json(
      { error: 'already_checked_out', recordId: record.id.toString() },
      { status: 409 }
    );
  }

  const now = new Date();
  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: { checkOutTime: now, checkOutLat: lat, checkOutLng: lng },
  });

  await writeAudit(req, session, {
    action: 'ATTENDANCE_CHECK_OUT',
    resourceType: 'attendance_record',
    resourceId: updated.id.toString(),
    metadata: { lat, lng },
  });

  return NextResponse.json({
    ok: true,
    record: {
      id: updated.id.toString(),
      checkInTime: updated.checkInTime?.toISOString() ?? null,
      checkOutTime: updated.checkOutTime?.toISOString() ?? null,
    },
  });
}

