/**
 * GET /api/users/workers — 가시범위 내 근로자 목록 (담당자 배정 dropdown용)
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const where: Prisma.UserWhereInput = { role: 'WORKER', status: 'ACTIVE' };
  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ workers: [] });
    where.contractorId = BigInt(session.contractorId);
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    where.contractor = { municipalityId: BigInt(session.municipalityId) };
  } else if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ workers: [] });
  }

  const workers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, contractorId: true, employeeNo: true },
    orderBy: [{ name: 'asc' }],
  });

  return NextResponse.json({
    workers: workers.map((w) => ({
      id: w.id.toString(),
      name: w.name,
      contractorId: w.contractorId?.toString() ?? null,
      employeeNo: w.employeeNo,
    })),
  });
}
