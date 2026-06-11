/**
 * POST /api/cron/gps-cleanup — PIPA 보존기간 초과 GPS 좌표 NULL 처리
 *
 * 정책: 위치정보보호법 — 작업 목적 달성 후 위치정보는 지체 없이 파기.
 *  운영 정책: 90일 경과 후 (분쟁 대응 + MOL 보고기한 30일 + 마진) NULL out
 *
 * 외부 cron (K8s CronJob 또는 GitHub Actions)에서 매일 03:30 KST 호출 권장.
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://wci.helpbiz.kr/api/cron/gps-cleanup
 *
 * Body (optional): { retentionDays?: number, dryRun?: boolean }
 *   기본 retentionDays=90, dryRun=false
 *
 * 영향 테이블:
 *   - attendance_record (check_in_lat/lng, check_out_lat/lng) — workDate 기준
 *   - complaint (location_lat/lng) — reportedAt 기준
 *   - safety_report (location_lat/lng) — createdAt 기준
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';

const authorized = isCronAuthorized;

const DEFAULT_RETENTION_DAYS = 90;

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const retentionDays = Number.isFinite(body?.retentionDays) && body.retentionDays > 0
    ? Math.floor(body.retentionDays)
    : DEFAULT_RETENTION_DAYS;
  const dryRun = body?.dryRun === true;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  /* dryRun: count only */
  if (dryRun) {
    const [att, cmp, sr] = await Promise.all([
      prisma.attendanceRecord.count({
        where: {
          workDate: { lt: cutoff },
          OR: [
            { checkInLat: { not: null } },
            { checkInLng: { not: null } },
            { checkOutLat: { not: null } },
            { checkOutLng: { not: null } },
          ],
        },
      }),
      prisma.complaint.count({
        where: {
          reportedAt: { lt: cutoff },
          OR: [{ locationLat: { not: null } }, { locationLng: { not: null } }],
        },
      }),
      prisma.safetyReport.count({
        where: {
          createdAt: { lt: cutoff },
          OR: [{ locationLat: { not: null } }, { locationLng: { not: null } }],
        },
      }),
    ]);
    return NextResponse.json({
      ok: true,
      dryRun: true,
      cutoff: cutoff.toISOString(),
      retentionDays,
      candidates: { attendance: att, complaint: cmp, safetyReport: sr },
    });
  }

  /* 실제 실행 — NULL out */
  const [att, cmp, sr] = await Promise.all([
    prisma.attendanceRecord.updateMany({
      where: {
        workDate: { lt: cutoff },
        OR: [
          { checkInLat: { not: null } },
          { checkInLng: { not: null } },
          { checkOutLat: { not: null } },
          { checkOutLng: { not: null } },
        ],
      },
      data: { checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null },
    }),
    prisma.complaint.updateMany({
      where: {
        reportedAt: { lt: cutoff },
        OR: [{ locationLat: { not: null } }, { locationLng: { not: null } }],
      },
      data: { locationLat: null, locationLng: null },
    }),
    prisma.safetyReport.updateMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [{ locationLat: { not: null } }, { locationLng: { not: null } }],
      },
      data: { locationLat: null, locationLng: null },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      action: 'CRON_GPS_CLEANUP',
      resourceType: 'system',
      resourceId: cutoff.toISOString().slice(0, 10),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        retentionDays,
        cutoff: cutoff.toISOString(),
        attendanceUpdated: att.count,
        complaintUpdated: cmp.count,
        safetyReportUpdated: sr.count,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    cutoff: cutoff.toISOString(),
    retentionDays,
    updated: { attendance: att.count, complaint: cmp.count, safetyReport: sr.count },
  });
}
