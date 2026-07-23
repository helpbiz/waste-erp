/**
 * PATCH  /api/shift-policies/[id] — 정책 수정
 * DELETE /api/shift-policies/[id] — 정책 삭제
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
  shiftType: z.enum(['DAY', 'NIGHT', 'DAWN']).optional(),
  checkInRecognizeFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkInRecognizeUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutRecognizeFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkOutRecognizeUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutNextDay: z.boolean().optional(),
  offDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  dayOfWeekOverride: z.number().int().min(0).max(6).optional().nullable(),
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
  const row = await prisma.shiftPolicy.findFirst({ where: { id, contractorId: BigInt(session.contractorId) } });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten() }, { status: 400 });

  const b = parsed.data;
  await prisma.shiftPolicy.update({
    where: { id },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.shiftType !== undefined && { shiftType: b.shiftType }),
      ...(b.checkInRecognizeFrom !== undefined && { checkInRecognizeFrom: b.checkInRecognizeFrom }),
      ...(b.checkInRecognizeUntil !== undefined && { checkInRecognizeUntil: b.checkInRecognizeUntil }),
      ...(b.checkOutRecognizeFrom !== undefined && { checkOutRecognizeFrom: b.checkOutRecognizeFrom }),
      ...(b.checkOutRecognizeUntil !== undefined && { checkOutRecognizeUntil: b.checkOutRecognizeUntil }),
      ...(b.checkOutNextDay !== undefined && { checkOutNextDay: b.checkOutNextDay }),
      ...(b.offDays !== undefined && { offDays: b.offDays ? JSON.stringify(b.offDays) : null }),
      ...(b.dayOfWeekOverride !== undefined && { dayOfWeekOverride: b.dayOfWeekOverride }),
      ...(b.active !== undefined && { active: b.active }),
      ...(b.sortOrder !== undefined && { sortOrder: b.sortOrder }),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'SHIFT_POLICY_UPDATE',
      resourceType: 'shift_policy',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { changedKeys: Object.keys(b) } as object,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const row = await prisma.shiftPolicy.findFirst({ where: { id, contractorId: BigInt(session.contractorId) } });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.shiftPolicy.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'SHIFT_POLICY_DELETE',
      resourceType: 'shift_policy',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { name: row.name } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
