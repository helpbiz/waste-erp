/**
 * GET  /api/punch-restrictions  — 출퇴근 제한 규칙 목록 (관리자)
 * POST /api/punch-restrictions  — 새 규칙 등록
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const Create = z.object({
  departmentId: z.string().optional().nullable(),
  name: z.string().min(1).max(80),
  checkInFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkInUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkOutUntil: z.string().regex(TimeRegex).optional().nullable(),
  requireLocationCheckIn: z.boolean().optional(),
  checkInLat: z.number().min(-90).max(90).optional().nullable(),
  checkInLng: z.number().min(-180).max(180).optional().nullable(),
  checkInRadiusMeters: z.number().int().min(10).max(50000).optional().nullable(),
  checkInLocationLabel: z.string().max(100).optional().nullable(),
  requireLocationCheckOut: z.boolean().optional(),
  checkOutLat: z.number().min(-90).max(90).optional().nullable(),
  checkOutLng: z.number().min(-180).max(180).optional().nullable(),
  checkOutRadiusMeters: z.number().int().min(10).max(50000).optional().nullable(),
  checkOutLocationLabel: z.string().max(100).optional().nullable(),
  allowedDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(_req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const rows = await prisma.punchRestriction.findMany({
    where: { contractorId: BigInt(session.contractorId) },
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { active: 'desc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id.toString(),
      departmentId: r.departmentId?.toString() ?? null,
      departmentName: r.department?.name ?? null,
      name: r.name,
      checkInFrom: r.checkInFrom,
      checkInUntil: r.checkInUntil,
      checkOutFrom: r.checkOutFrom,
      checkOutUntil: r.checkOutUntil,
      requireLocationCheckIn: r.requireLocationCheckIn,
      checkInLat: r.checkInLat ? Number(r.checkInLat) : null,
      checkInLng: r.checkInLng ? Number(r.checkInLng) : null,
      checkInRadiusMeters: r.checkInRadiusMeters,
      checkInLocationLabel: r.checkInLocationLabel,
      requireLocationCheckOut: r.requireLocationCheckOut,
      checkOutLat: r.checkOutLat ? Number(r.checkOutLat) : null,
      checkOutLng: r.checkOutLng ? Number(r.checkOutLng) : null,
      checkOutRadiusMeters: r.checkOutRadiusMeters,
      checkOutLocationLabel: r.checkOutLocationLabel,
      allowedDays: r.allowedDays ? JSON.parse(r.allowedDays) : null,
      active: r.active,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten() }, { status: 400 });

  const b = parsed.data;
  const contractorId = BigInt(session.contractorId);

  if (b.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: BigInt(b.departmentId), contractorId },
    });
    if (!dept) return NextResponse.json({ error: 'department_not_found' }, { status: 404 });
  }

  const row = await prisma.punchRestriction.create({
    data: {
      contractorId,
      departmentId: b.departmentId ? BigInt(b.departmentId) : null,
      name: b.name,
      checkInFrom: b.checkInFrom ?? null,
      checkInUntil: b.checkInUntil ?? null,
      checkOutFrom: b.checkOutFrom ?? null,
      checkOutUntil: b.checkOutUntil ?? null,
      requireLocationCheckIn: b.requireLocationCheckIn ?? false,
      checkInLat: b.checkInLat ?? null,
      checkInLng: b.checkInLng ?? null,
      checkInRadiusMeters: b.checkInRadiusMeters ?? null,
      checkInLocationLabel: b.checkInLocationLabel ?? null,
      requireLocationCheckOut: b.requireLocationCheckOut ?? false,
      checkOutLat: b.checkOutLat ?? null,
      checkOutLng: b.checkOutLng ?? null,
      checkOutRadiusMeters: b.checkOutRadiusMeters ?? null,
      checkOutLocationLabel: b.checkOutLocationLabel ?? null,
      allowedDays: b.allowedDays ? JSON.stringify(b.allowedDays) : null,
      active: b.active ?? true,
      createdBy: BigInt(session.userId),
    },
  });

  return NextResponse.json({ ok: true, id: row.id.toString() }, { status: 201 });
}
