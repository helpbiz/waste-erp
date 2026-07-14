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

const ADMIN_ROLES = ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] as const;
function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

const Body = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER' && !isAdminRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let rawLat: number | null = null;
  let rawLng: number | null = null;

  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    /* P0-residual: PIPA — GPS 라운딩 */
    rawLat = roundCoord(parsed.data.lat) as number;
    rawLng = roundCoord(parsed.data.lng) as number;
    if (!isInsideKorea(rawLat, rawLng)) {
      return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
    }
    const gpsOn = session.contractorId ? await hasFeature(session.contractorId, 'attendanceGps') : false;
    lat = gpsOn ? rawLat : null;
    lng = gpsOn ? rawLng : null;
  }

  const today = todayKstDate();
  const workerId = BigInt(session.userId);

  /* 출퇴근 제한 규칙 — 관리자는 제외, 퇴근은 퇴근 전용 위치 제한(requireLocationCheckOut) 적용 */
  if (!isAdminRole(session.role) && session.contractorId) {
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
    const kstDayOfWeek = (kstNow.getUTCDay() + 6) % 7; // 0=월 ~ 5=토, 6=일
    for (const r of restrictions) {
      if (r.allowedDays) {
        const days: number[] = JSON.parse(r.allowedDays);
        if (!days.includes(kstDayOfWeek)) continue;
      }
      if (r.checkOutFrom && kstHHMM < r.checkOutFrom) {
        return NextResponse.json({ error: 'punch_too_early', allowFrom: r.checkOutFrom, rule: r.name }, { status: 403 });
      }
      if (r.checkOutUntil && kstHHMM > r.checkOutUntil) {
        return NextResponse.json({ error: 'punch_too_late', allowUntil: r.checkOutUntil, rule: r.name }, { status: 403 });
      }
      /* 퇴근 전용 위치 제한 */
      if (r.requireLocationCheckOut && r.checkOutLat != null && r.checkOutLng != null && r.checkOutRadiusMeters) {
        if (rawLat == null || rawLng == null) {
          return NextResponse.json({ error: 'gps_required' }, { status: 400 });
        }
        const dist = haversineM(rawLat, rawLng, Number(r.checkOutLat), Number(r.checkOutLng));
        if (dist > r.checkOutRadiusMeters) {
          return NextResponse.json({
            error: 'outside_allowed_location',
            rule: r.name,
            location: r.checkOutLocationLabel ?? '지정 장소',
            distanceM: Math.round(dist),
            allowedRadiusM: r.checkOutRadiusMeters,
          }, { status: 403 });
        }
      }
    }
  }

  let record = await prisma.attendanceRecord.findUnique({
    where: { workerId_workDate: { workerId, workDate: today } },
  });
  /* 야간 근무: 오늘 기록이 없거나 출근 미등록이면 어제 열린 기록 확인 */
  if (!record?.checkInTime) {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const nightRecord = await prisma.attendanceRecord.findUnique({
      where: { workerId_workDate: { workerId, workDate: yesterday } },
    });
    if (nightRecord?.checkInTime && !nightRecord.checkOutTime) {
      record = nightRecord;
    }
  }
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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

