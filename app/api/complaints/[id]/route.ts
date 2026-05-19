/**
 * PATCH /api/complaints/[id] — 민원 수정 (관리자/담당)
 *  허용 필드: type, description, locationAddress, locationLat/Lng, urgentTag, isUrgent, requestImage
 *  - 처리 완료/반려된 민원은 수정 불가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { roundCoord } from '@/lib/geo';
import { complaintWhere, canTransitionComplaint, isComplaintManager } from '@/lib/complaints';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const Patch = z.object({
  type: z.enum(['PICKUP_MISS', 'ILLEGAL_DUMP', 'ODOR_NOISE', 'BULKY_WASTE', 'OTHER']).optional(),
  status: z.enum(['RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']).optional(),
  description: z.string().max(2000).nullable().optional(),
  locationAddress: z.string().max(255).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  urgentTag: z.enum(['LONG_NEGLECTED', 'ROAD_KILL', 'KIDS_DANGER', 'OTHER']).nullable().optional(),
  isUrgent: z.boolean().optional(),
  requestImage: z.string().max(2_000_000).nullable().optional(),
  complainantPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session, workerIsManager) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target, workerIsManager)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.type !== undefined) data.type = b.type;
  if (b.status !== undefined) data.status = b.status;
  if (b.description !== undefined) data.description = b.description;
  if (b.locationAddress !== undefined) data.locationAddress = b.locationAddress;
  if (b.locationLat !== undefined) data.locationLat = roundCoord(b.locationLat);
  if (b.locationLng !== undefined) data.locationLng = roundCoord(b.locationLng);
  if (b.urgentTag !== undefined) data.urgentTag = b.urgentTag;
  if (b.isUrgent !== undefined) data.isUrgent = b.isUrgent;
  if (b.requestImage !== undefined) data.requestImage = b.requestImage;
  if (b.complainantPhone !== undefined) data.complainantPhone = b.complainantPhone?.replace(/-/g, '') ?? null;

  await prisma.complaint.update({ where: { id }, data });
  await writeAudit(req, session, {
    action: 'COMPLAINT_UPDATE',
    resourceType: 'complaint',
    resourceId: id.toString(),
    metadata: { fields: Object.keys(data) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session, workerIsManager) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target, workerIsManager)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await prisma.complaint.delete({ where: { id } });
  await writeAudit(req, session, {
    action: 'COMPLAINT_DELETE',
    resourceType: 'complaint',
    resourceId: id.toString(),
    metadata: {},
  });
  return NextResponse.json({ ok: true });
}
