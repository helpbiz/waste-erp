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
type AdminRole = typeof ADMIN_ROLES[number];
function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

const Body = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  zoneId: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (session.role !== 'WORKER' && !isAdminRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor_assigned' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { zoneId } = parsed.data;
  let lat: number | null = null;
  let lng: number | null = null;

  /* GPS 검증 — 관리자는 좌표 없이도 출근 허용 */
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    const rawLat = roundCoord(parsed.data.lat) as number;
    const rawLng = roundCoord(parsed.data.lng) as number;
    if (!isInsideKorea(rawLat, rawLng)) {
      return NextResponse.json(
        { error: 'gps_out_of_range', message: '국내 위경도 박스 밖의 좌표입니다.' },
        { status: 422 }
      );
    }
    const gpsOn = await hasFeature(session.contractorId, 'attendanceGps');
    lat = gpsOn ? rawLat : null;
    lng = gpsOn ? rawLng : null;

    /* 출퇴근 제한 규칙 — 관리자는 적용 제외 */
    if (!isAdminRole(session.role)) {
      const contractorId = BigInt(session.contractorId);
      const workerId = BigInt(session.userId);
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
      for (const r of restrictions) {
        if (r.checkInFrom && kstHHMM < r.checkInFrom) {
          return NextResponse.json({ error: 'punch_too_early', allowFrom: r.checkInFrom, rule: r.name }, { status: 403 });
        }
        if (r.checkInUntil && kstHHMM > r.checkInUntil) {
          return NextResponse.json({ error: 'punch_too_late', allowUntil: r.checkInUntil, rule: r.name }, { status: 403 });
        }
        if (r.requireLocation && r.lat != null && r.lng != null && r.radiusMeters) {
          const dist = haversineM(rawLat, rawLng, Number(r.lat), Number(r.lng));
          if (dist > r.radiusMeters) {
            return NextResponse.json({
              error: 'outside_allowed_location',
              rule: r.name,
              location: r.locationLabel ?? '지정 장소',
              distanceM: Math.round(dist),
              allowedRadiusM: r.radiusMeters,
            }, { status: 403 });
          }
        }
      }
    }
  } else if (!isAdminRole(session.role)) {
    /* 워커는 GPS 필수 */
    return NextResponse.json({ error: 'gps_required' }, { status: 400 });
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

  await writeAudit(req, session, {
    action: 'ATTENDANCE_CHECK_IN',
    resourceType: 'attendance_record',
    resourceId: record.id.toString(),
    metadata: { lat, lng, zoneId: zoneId ?? null },
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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
