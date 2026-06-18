/**
 * GET  /api/contractor/worker-zones — 업체 전체 작업자 담당구역 목록
 * POST /api/contractor/worker-zones — 작업자 담당구역 추가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PostBody = z.object({
  userId: z.string().min(1),
  zoneId: z.string().min(1),
  dongId: z.string().nullable().optional(),
  addressType: z.enum(['road', 'lot']).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = session.contractorId;
  if (!contractorId) return NextResponse.json({ assignments: [] });

  const assignments = await prisma.workerZone.findMany({
    where: { contractorId: BigInt(contractorId) },
    orderBy: [{ user: { name: 'asc' } }, { zone: { zoneName: 'asc' } }],
    include: {
      user: { select: { id: true, name: true, employeeNo: true, status: true } },
      zone: { select: { id: true, zoneName: true, zoneCode: true } },
      dong: { select: { id: true, dongName: true, dongCode: true } },
    },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      id: a.id.toString(),
      userId: a.userId.toString(),
      userName: a.user.name,
      employeeNo: a.user.employeeNo,
      userStatus: a.user.status,
      zoneId: a.zoneId.toString(),
      zoneName: a.zone.zoneName,
      zoneCode: a.zone.zoneCode,
      dongId: a.dongId?.toString() ?? null,
      dongName: a.dong?.dongName ?? null,
      dongCode: a.dong?.dongCode ?? null,
      addressType: a.addressType,
      address: a.address,
      memo: a.memo,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = session.contractorId;
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;

  /* zone이 본 업체 소속인지 검증 */
  const zone = await prisma.cleaningZone.findFirst({
    where: { id: BigInt(b.zoneId), contractorId: BigInt(contractorId) },
  });
  if (!zone) return NextResponse.json({ error: 'zone_not_found' }, { status: 404 });

  /* user가 본 업체 소속인지 검증 */
  const user = await prisma.user.findFirst({
    where: { id: BigInt(b.userId), contractorId: BigInt(contractorId) },
  });
  if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  /* dongId 있으면 해당 zone 소속인지 검증 */
  if (b.dongId) {
    const dong = await prisma.adminDong.findFirst({
      where: { id: BigInt(b.dongId), zoneId: BigInt(b.zoneId) },
    });
    if (!dong) return NextResponse.json({ error: 'dong_not_in_zone' }, { status: 400 });
  }

  try {
    const created = await prisma.workerZone.create({
      data: {
        userId: BigInt(b.userId),
        contractorId: BigInt(contractorId),
        zoneId: BigInt(b.zoneId),
        dongId: b.dongId ? BigInt(b.dongId) : null,
        addressType: b.addressType ?? null,
        address: b.address?.trim() || null,
        memo: b.memo?.trim() || null,
      },
    });
    return NextResponse.json({ id: created.id.toString() }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'duplicate_assignment' }, { status: 409 });
    }
    throw e;
  }
}
