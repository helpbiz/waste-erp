/**
 * GET /api/contractors?active=true — 위탁업체 목록 (권한별 가시범위)
 *
 * Plan SC: F-02 PDF 다운로드 시 위탁업체 선택용 (SUPER_ADMIN, MUNI_ADMIN)
 *  - SUPER_ADMIN: 전체
 *  - MUNI_ADMIN: 자기 관할 지자체 산하만
 *  - 기타: 자사만
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const onlyActive = url.searchParams.get('active') === 'true';

  const where: { status?: 'ACTIVE'; municipalityId?: bigint; id?: bigint } = {};
  if (onlyActive) where.status = 'ACTIVE';

  if (session.role === 'SUPER_ADMIN') {
    /* 전체 */
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    where.municipalityId = BigInt(session.municipalityId);
  } else if (session.contractorId) {
    where.id = BigInt(session.contractorId);
  } else {
    return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
  }

  const items = await prisma.contractor.findMany({
    where,
    include: { municipality: { select: { id: true, name: true } } },
    orderBy: [{ companyName: 'asc' }],
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id.toString(),
      companyName: c.companyName,
      businessNo: c.businessNo,
      status: c.status,
      active: c.status === 'ACTIVE',
      municipalityName: c.municipality?.name ?? null,
    })),
  });
}
