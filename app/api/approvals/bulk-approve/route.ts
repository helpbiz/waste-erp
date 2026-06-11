/**
 * POST /api/approvals/bulk-approve
 * 복수 결재 건 일괄 승인 (leave, attendance, vehicleLog, safety)
 * safety는 reviewNote 필수 (공통 메모 사용)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

const Body = z.object({
  items: z.array(z.object({
    kind: z.enum(['leave', 'attendance', 'vehicleLog', 'safety']),
    id:   z.string(),
  })).min(1).max(100),
  reviewNote: z.string().trim().max(500).optional(),
});

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role) && !canManageUsers(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { items, reviewNote } = parsed.data;
  const results: Array<{ kind: string; id: string; ok: boolean; error?: string }> = [];

  for (const item of items) {
    const itemId = parseId(item.id);
    if (!itemId) { results.push({ kind: item.kind, id: item.id, ok: false, error: 'invalid_id' }); continue; }
    try {
      if (item.kind === 'leave') {
        await prisma.leaveRequest.update({
          where: { id: itemId },
          data: { status: 'APPROVED' },
        });
        results.push({ kind: item.kind, id: item.id, ok: true });

      } else if (item.kind === 'attendance') {
        await prisma.attendanceRecord.update({
          where: { id: itemId },
          data: { status: 'APPROVED' },
        });
        results.push({ kind: item.kind, id: item.id, ok: true });

      } else if (item.kind === 'vehicleLog') {
        const log = await prisma.vehicleLog.findUnique({
          where: { id: itemId },
          select: { vehicleId: true, endMileage: true, startMileage: true },
        });
        if (!log) { results.push({ kind: item.kind, id: item.id, ok: false, error: 'not_found' }); continue; }

        const delta = log.endMileage != null && log.startMileage != null
          ? log.endMileage - log.startMileage : 0;

        await prisma.$transaction([
          prisma.vehicleLog.update({
            where: { id: itemId },
            data: { status: 'APPROVED' },
          }),
          ...(delta > 0 ? [prisma.vehicle.update({
            where: { id: log.vehicleId },
            data: { totalMileage: { increment: delta } },
          })] : []),
        ]);
        results.push({ kind: item.kind, id: item.id, ok: true });

      } else if (item.kind === 'safety') {
        const note = reviewNote?.trim() || '일괄 검토 완료';
        const reviewerId = parseId(session.userId);
        await prisma.safetyReport.update({
          where: { id: itemId },
          data: {
            status: 'REVIEWED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewNote: note,
          },
        });
        results.push({ kind: item.kind, id: item.id, ok: true });
      }
    } catch (e) {
      results.push({ kind: item.kind, id: item.id, ok: false, error: String(e) });
    }
  }

  const okCount   = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  return NextResponse.json({ ok: failCount === 0, okCount, failCount, results });
}
