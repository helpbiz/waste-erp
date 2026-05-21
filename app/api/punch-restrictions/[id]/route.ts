/**
 * PATCH  /api/punch-restrictions/[id] — 규칙 수정
 * DELETE /api/punch-restrictions/[id] — 규칙 삭제
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  departmentId: z.string().optional().nullable(),
  checkInFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkInUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkOutUntil: z.string().regex(TimeRegex).optional().nullable(),
  requireLocation: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  radiusMeters: z.number().int().min(10).max(50000).optional().nullable(),
  locationLabel: z.string().max(100).optional().nullable(),
  allowedDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const row = await prisma.punchRestriction.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten() }, { status: 400 });

  const b = parsed.data;
  await prisma.punchRestriction.update({
    where: { id },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.departmentId !== undefined && { departmentId: b.departmentId ? BigInt(b.departmentId) : null }),
      ...(b.checkInFrom !== undefined && { checkInFrom: b.checkInFrom }),
      ...(b.checkInUntil !== undefined && { checkInUntil: b.checkInUntil }),
      ...(b.checkOutFrom !== undefined && { checkOutFrom: b.checkOutFrom }),
      ...(b.checkOutUntil !== undefined && { checkOutUntil: b.checkOutUntil }),
      ...(b.requireLocation !== undefined && { requireLocation: b.requireLocation }),
      ...(b.lat !== undefined && { lat: b.lat }),
      ...(b.lng !== undefined && { lng: b.lng }),
      ...(b.radiusMeters !== undefined && { radiusMeters: b.radiusMeters }),
      ...(b.locationLabel !== undefined && { locationLabel: b.locationLabel }),
      ...(b.allowedDays !== undefined && { allowedDays: b.allowedDays ? JSON.stringify(b.allowedDays) : null }),
      ...(b.active !== undefined && { active: b.active }),
      ...(b.sortOrder !== undefined && { sortOrder: b.sortOrder }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const row = await prisma.punchRestriction.findFirst({
    where: { id, contractorId: BigInt(session.contractorId) },
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.punchRestriction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
