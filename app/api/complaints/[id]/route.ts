/**
 * PATCH /api/complaints/[id] — 민원 수정 (관리자/담당)
 *  허용 필드: type, description, locationAddress, locationLat/Lng, urgentTag, isUrgent, requestImage
 *  - 처리 완료/반려된 민원은 수정 불가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere, canTransitionComplaint } from '@/lib/complaints';

export const runtime = 'nodejs';

const Patch = z.object({
  type: z.enum(['PICKUP_MISS', 'ILLEGAL_DUMP', 'ODOR_NOISE', 'BULKY_WASTE', 'OTHER']).optional(),
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

  const id = BigInt(params.id);
  const target = await prisma.complaint.findFirst({
    where: { id, ...complaintWhere(session) },
    select: { id: true, status: true, assignedTo: true },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canTransitionComplaint(session, target)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (target.status === 'COMPLETED' || target.status === 'REJECTED') {
    return NextResponse.json({ error: 'invalid_state', current: target.status }, { status: 409 });
  }

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.type !== undefined) data.type = b.type;
  if (b.description !== undefined) data.description = b.description;
  if (b.locationAddress !== undefined) data.locationAddress = b.locationAddress;
  if (b.locationLat !== undefined) data.locationLat = b.locationLat;
  if (b.locationLng !== undefined) data.locationLng = b.locationLng;
  if (b.urgentTag !== undefined) data.urgentTag = b.urgentTag;
  if (b.isUrgent !== undefined) data.isUrgent = b.isUrgent;
  if (b.requestImage !== undefined) data.requestImage = b.requestImage;
  if (b.complainantPhone !== undefined) data.complainantPhone = b.complainantPhone?.replace(/-/g, '') ?? null;

  await prisma.complaint.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'COMPLAINT_UPDATE',
      resourceType: 'complaint',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(data) } as object,
    },
  });
  return NextResponse.json({ ok: true });
}
