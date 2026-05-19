/**
 * GET  /api/safety/reports — 가시범위 내 보고서 목록
 * POST /api/safety/reports — 안전 보고 등록 (worker, 또는 admin 대신 등록)
 *
 * 일일 체크리스트는 (worker, date) 단일 보장 (스키마 unique constraint)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { todayKstDate } from '@/lib/dates';
import { safetyWhere, computeMolDeadline, type ChecklistItem } from '@/lib/safety';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const PostBody = z.object({
  reportType: z.enum(['DAILY_CHECKLIST', 'NEAR_MISS', 'INCIDENT', 'TBM_SIGNATURE']),
  severity: z.enum(['NONE', 'MINOR', 'INJURY', 'SEVERE', 'FATAL']).optional(),
  description: z.string().trim().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  locationAddress: z.string().trim().max(255).optional(),
  checklistItems: z.array(z.object({
    key: z.string().max(40),
    label: z.string().max(100),
    ok: z.boolean(),
    reason: z.string().max(500).optional(), /* 미체크 시 사유 (근로자 입력) */
  })).optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const reportType = url.searchParams.get('reportType');
  const severity = url.searchParams.get('severity');

  const where = safetyWhere(session);
  if (reportType && ['DAILY_CHECKLIST', 'NEAR_MISS', 'INCIDENT', 'TBM_SIGNATURE'].includes(reportType)) {
    (where as Record<string, unknown>).reportType = reportType;
  }
  if (severity && ['NONE', 'MINOR', 'INJURY', 'SEVERE', 'FATAL'].includes(severity)) {
    (where as Record<string, unknown>).severity = severity;
  }

  const items = await prisma.safetyReport.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    include: {
      reporter: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    role: session.role,
    items: items.map((r) => ({
      id: r.id.toString(),
      reportType: r.reportType,
      severity: r.severity,
      reportDate: r.reportDate.toISOString().slice(0, 10),
      occurredAt: r.occurredAt?.toISOString() ?? null,
      description: r.description,
      locationAddress: r.locationAddress,
      locationLat: r.locationLat ? Number(r.locationLat) : null,
      locationLng: r.locationLng ? Number(r.locationLng) : null,
      allChecked: r.allChecked,
      checklistItems: (r.checklistItems as ChecklistItem[] | null) ?? null,
      status: r.status,
      reviewNote: r.reviewNote,
      molDeadline: r.molDeadline?.toISOString() ?? null,
      molReportedAt: r.molReportedAt?.toISOString() ?? null,
      reportedAt: r.createdAt.toISOString(),
      reporter: { id: r.reporter.id.toString(), name: r.reporter.name },
      reviewer: r.reviewer ? { id: r.reviewer.id.toString(), name: r.reviewer.name } : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  /* contractorId — WORKER/INTERNAL/CONTRACTOR_ADMIN: 본인 소속 / SUPER·MUNI: 입력 contractorId 필요 (시안 미지원) */
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
  }
  const contractorId = BigInt(session.contractorId);

  /* GPS 검증 */
  if (b.locationLat != null && b.locationLng != null && !isInsideKorea(b.locationLat, b.locationLng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  /* 체크리스트 검증 + 일일 중복 방지 (application-level) */
  let allChecked = false;
  if (b.reportType === 'DAILY_CHECKLIST') {
    if (!b.checklistItems || b.checklistItems.length === 0) {
      return NextResponse.json({ error: 'checklist_required' }, { status: 400 });
    }
    allChecked = b.checklistItems.every((i) => i.ok);

    const today = todayKstDate();
    const existing = await prisma.safetyReport.findFirst({
      where: {
        reportedBy: BigInt(session.userId),
        reportDate: today,
        reportType: 'DAILY_CHECKLIST',
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'duplicate_daily_report' }, { status: 409 });
    }
  }

  /* 재해 — severity / occurredAt 필요 */
  let molDeadline: Date | null = null;
  let occurredAt: Date | null = null;
  if (b.reportType === 'INCIDENT') {
    if (!b.severity || b.severity === 'NONE') {
      return NextResponse.json({ error: 'severity_required' }, { status: 400 });
    }
    occurredAt = b.occurredAt ? new Date(b.occurredAt) : new Date();
    molDeadline = computeMolDeadline(b.severity, occurredAt);
  } else if (b.occurredAt) {
    occurredAt = new Date(b.occurredAt);
  }

  const reportDate = todayKstDate();

  try {
    const created = await prisma.safetyReport.create({
      data: {
        contractorId,
        reportedBy: BigInt(session.userId),
        reportType: b.reportType,
        severity: b.severity ?? 'NONE',
        reportDate,
        occurredAt,
        checklistItems: b.checklistItems ? (b.checklistItems as object) : undefined,
        allChecked,
        locationLat: roundCoord(b.locationLat),
        locationLng: roundCoord(b.locationLng),
        locationAddress: b.locationAddress ?? null,
        description: b.description ?? null,
        molDeadline,
        status: 'SUBMITTED',
      },
    });

    await writeAudit(req, session, {
      action: 'SAFETY_REPORT_CREATE',
      resourceType: 'safety_report',
      resourceId: created.id.toString(),
      metadata: {
        reportType: b.reportType,
        severity: b.severity ?? 'NONE',
        molDeadline: molDeadline?.toISOString() ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      report: {
        id: created.id.toString(),
        reportType: created.reportType,
        severity: created.severity,
        status: created.status,
        molDeadline: molDeadline?.toISOString() ?? null,
      },
    });
  } catch (e: unknown) {
    /* unique constraint 위반 (일일 체크리스트 중복) */
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'duplicate_daily_report' }, { status: 409 });
    }
    throw e;
  }
}
