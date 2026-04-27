/**
 * POST /api/safety/reports/[id]/review
 * - 보고서 검토 + 상태 전이 (SUBMITTED → REVIEWED / MOL_REPORTED / RESOLVED)
 * - 권한: 매니저 (SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { safetyWhere, isSafetyManager } from '@/lib/safety';

export const runtime = 'nodejs';

const Body = z.object({
  toStatus: z.enum(['REVIEWED', 'MOL_REPORTED', 'RESOLVED']),
  reviewNote: z.string().trim().min(2).max(2000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isSafetyManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const id = BigInt(params.id);
  const target = await prisma.safetyReport.findFirst({ where: { id, ...safetyWhere(session) } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const now = new Date();
  const updated = await prisma.safetyReport.update({
    where: { id },
    data: {
      status: parsed.data.toStatus,
      reviewedBy: BigInt(session.userId),
      reviewedAt: now,
      reviewNote: parsed.data.reviewNote,
      ...(parsed.data.toStatus === 'MOL_REPORTED' ? { molReportedAt: now } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'SAFETY_REPORT_REVIEW',
      resourceType: 'safety_report',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { toStatus: parsed.data.toStatus, reviewNoteLen: parsed.data.reviewNote.length } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    report: {
      id: updated.id.toString(),
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      molReportedAt: updated.molReportedAt?.toISOString() ?? null,
    },
  });
}
