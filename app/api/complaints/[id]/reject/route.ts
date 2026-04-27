/**
 * POST /api/complaints/[id]/reject
 * - 반려 (→ REJECTED) + 사유 필수
 * - 권한: 매니저만 (SUPER, CONTRACTOR_ADMIN, INTERNAL_ADMIN)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, isComplaintManager } from '@/lib/complaints';

export const runtime = 'nodejs';

const Body = z.object({
  reason: z.string().trim().min(2).max(2000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isComplaintManager(session.role)) {
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
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session) },
    select: { id: true, status: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target.status === 'REJECTED' || target.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'invalid_transition', from: target.status, to: 'REJECTED' },
      { status: 409 }
    );
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'REJECTED', resolveNote: parsed.data.reason, resolvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_REJECT',
      resourceType: 'complaint',
      resourceId: updated.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { reasonLen: parsed.data.reason.length } as object,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
