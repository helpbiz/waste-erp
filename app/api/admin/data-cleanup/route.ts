/**
 * POST /api/admin/data-cleanup
 * 항목별 일자 기준 일괄 삭제 (SUPER_ADMIN / CONTRACTOR_ADMIN)
 * body: { type, cutoffDate, dryRun? }
 * dryRun=true → 삭제 건수만 반환, 실제 삭제 없음
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { contractorScopeWhere } from '@/lib/scopes';

export const runtime = 'nodejs';

const TYPES = [
  'vehicleLog',
  'complaint',
  'attendance',
  'leaveRequest',
  'tbmSession',
  'safetyReport',
] as const;

const Body = z.object({
  type: z.enum(TYPES),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dryRun: z.boolean().default(true),
});

function isAdmin(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { type, cutoffDate, dryRun } = parsed.data;
  const cutoff = new Date(cutoffDate + 'T23:59:59Z');
  const scope = contractorScopeWhere(session);
  const contractorId = session.contractorId ? BigInt(session.contractorId) : undefined;

  let count = 0;

  if (type === 'vehicleLog') {
    const where = { ...(contractorId ? { contractorId } : {}), logDate: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.vehicleLog.count({ where });
    } else {
      const r = await prisma.vehicleLog.deleteMany({ where });
      count = r.count;
    }

  } else if (type === 'complaint') {
    const where = { ...(contractorId ? { contractorId } : {}), createdAt: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.complaint.count({ where });
    } else {
      const r = await prisma.complaint.deleteMany({ where });
      count = r.count;
    }

  } else if (type === 'attendance') {
    const where = { ...scope, workDate: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.attendanceRecord.count({ where });
    } else {
      const r = await prisma.attendanceRecord.deleteMany({ where });
      count = r.count;
    }

  } else if (type === 'leaveRequest') {
    const where = contractorId
      ? { worker: { contractorId } as { contractorId: bigint }, createdAt: { lte: cutoff } }
      : { createdAt: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.leaveRequest.count({ where });
    } else {
      const r = await prisma.leaveRequest.deleteMany({ where });
      count = r.count;
    }

  } else if (type === 'tbmSession') {
    const where = { ...(contractorId ? { contractorId } : {}), sessionDate: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.tbmSession.count({ where });
    } else {
      const r = await prisma.tbmSession.deleteMany({ where });
      count = r.count;
    }

  } else if (type === 'safetyReport') {
    const where = { ...(contractorId ? { contractorId } : {}), reportDate: { lte: cutoff } };
    if (dryRun) {
      count = await prisma.safetyReport.count({ where });
    } else {
      const r = await prisma.safetyReport.deleteMany({ where });
      count = r.count;
    }
  }

  if (!dryRun) {
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'ADMIN_DATA_CLEANUP',
        resourceType: type,
        resourceId: `cutoff:${cutoffDate}`,
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: { type, cutoffDate, deletedCount: count } as object,
      },
    });
  }

  return NextResponse.json({ ok: true, count, dryRun });
}
