import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { todayKstDate } from '@/lib/dates';
import { writeAudit } from '@/lib/audit';

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
  const lat = roundCoord(parsed.data.lat) as number;
  const lng = roundCoord(parsed.data.lng) as number;
  if (!isInsideKorea(lat, lng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  const today = todayKstDate();
  const workerId = BigInt(session.userId);

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
