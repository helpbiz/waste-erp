/**
 * GET  /api/shift-policies?departmentId=&workerId=  — 근무유형별 인정시간 정책 목록 (관리자)
 *      쿼리 미지정 시 전체(회사+부서+개인) 목록, departmentId/workerId 지정 시 해당 스코프만.
 * POST /api/shift-policies  — 새 정책 등록 (회사 전체 = departmentId/workerId 둘 다 생략)
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
  workerId: z.string().optional().nullable(),
  shiftType: z.enum(['DAY', 'NIGHT', 'DAWN']),
  name: z.string().min(1).max(80),
  checkInRecognizeFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkInRecognizeUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutRecognizeFrom: z.string().regex(TimeRegex).optional().nullable(),
  checkOutRecognizeUntil: z.string().regex(TimeRegex).optional().nullable(),
  checkOutNextDay: z.boolean().optional(),
  offDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const departmentIdParam = url.searchParams.get('departmentId');
  const workerIdParam = url.searchParams.get('workerId');

  const where: {
    contractorId: bigint;
    departmentId?: bigint | null;
    workerId?: bigint | null;
  } = { contractorId: BigInt(session.contractorId) };
  if (workerIdParam) where.workerId = BigInt(workerIdParam);
  else if (departmentIdParam) { where.departmentId = BigInt(departmentIdParam); where.workerId = null; }

  const rows = await prisma.shiftPolicy.findMany({
    where,
    include: {
      department: { select: { id: true, name: true } },
      worker: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { active: 'desc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id.toString(),
      departmentId: r.departmentId?.toString() ?? null,
      departmentName: r.department?.name ?? null,
      workerId: r.workerId?.toString() ?? null,
      workerName: r.worker?.name ?? null,
      shiftType: r.shiftType,
      name: r.name,
      checkInRecognizeFrom: r.checkInRecognizeFrom,
      checkInRecognizeUntil: r.checkInRecognizeUntil,
      checkOutRecognizeFrom: r.checkOutRecognizeFrom,
      checkOutRecognizeUntil: r.checkOutRecognizeUntil,
      checkOutNextDay: r.checkOutNextDay,
      offDays: r.offDays ? JSON.parse(r.offDays) : null,
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

  if (b.departmentId && b.workerId) {
    return NextResponse.json({ error: 'scope_conflict', message: '부서와 개인 스코프는 동시에 지정할 수 없습니다.' }, { status: 400 });
  }
  if (b.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: BigInt(b.departmentId), contractorId } });
    if (!dept) return NextResponse.json({ error: 'department_not_found' }, { status: 404 });
  }
  if (b.workerId) {
    const worker = await prisma.user.findFirst({ where: { id: BigInt(b.workerId), contractorId, role: 'WORKER' } });
    if (!worker) return NextResponse.json({ error: 'worker_not_found' }, { status: 404 });
  }

  const row = await prisma.shiftPolicy.create({
    data: {
      contractorId,
      departmentId: b.departmentId ? BigInt(b.departmentId) : null,
      workerId: b.workerId ? BigInt(b.workerId) : null,
      shiftType: b.shiftType,
      name: b.name,
      checkInRecognizeFrom: b.checkInRecognizeFrom ?? null,
      checkInRecognizeUntil: b.checkInRecognizeUntil ?? null,
      checkOutRecognizeFrom: b.checkOutRecognizeFrom ?? null,
      checkOutRecognizeUntil: b.checkOutRecognizeUntil ?? null,
      checkOutNextDay: b.checkOutNextDay ?? false,
      offDays: b.offDays ? JSON.stringify(b.offDays) : null,
      active: b.active ?? true,
      createdBy: BigInt(session.userId),
    },
  });

  return NextResponse.json({ ok: true, id: row.id.toString() }, { status: 201 });
}
