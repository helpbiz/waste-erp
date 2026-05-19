/**
 * GET /api/lookup/dongs?municipalityCode=11410
 * cost API (cost-mvp-api:8020) 에서 행정동 코드·인구·면적 목록을 가져오는 프록시.
 * 세션에서 contractor → municipality code를 자동 추출하므로
 * 쿼리파라미터는 SUPER_ADMIN/INTERNAL_ADMIN용 override에만 사용.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export type DongLookupItem = {
  dongCode: string | null;  // admin_dongs 없으면 null (dong_annual_stats fallback)
  dongName: string;
  population: number | null;
  areaKm2: number | null;
};

const COST_API_URL = process.env.COST_API_URL ?? 'http://localhost:8020';

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const overrideCode = searchParams.get('municipalityCode');

  let municipalityCode: string | null = null;

  if (overrideCode && ['SUPER_ADMIN', 'INTERNAL_ADMIN'].includes(session.role)) {
    municipalityCode = overrideCode;
  } else if (session.contractorId) {
    const contractor = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      include: { municipality: { select: { code: true } } },
    });
    municipalityCode = contractor?.municipality?.code ?? null;
  }

  if (!municipalityCode) {
    return NextResponse.json({ error: 'municipality_not_found' }, { status: 404 });
  }

  let data: { dong_code: string | null; dong_name: string; population: number | null; area_km2: number | null }[];
  try {
    const res = await fetch(`${COST_API_URL}/api/municipalities/${municipalityCode}/admin-dongs`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'cost_api_error', status: res.status }, { status: 502 });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'cost_api_unreachable' }, { status: 503 });
  }

  const dongs: DongLookupItem[] = data.map((d) => ({
    dongCode: d.dong_code,
    dongName: d.dong_name,
    population: d.population,
    areaKm2: d.area_km2,
  }));

  return NextResponse.json({ municipalityCode, dongs });
}
