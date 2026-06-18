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

  /* COST API 시도, 실패 시 DB의 admin_dongs 로 폴백 */
  let dongs: DongLookupItem[];
  try {
    const res = await fetch(`${COST_API_URL}/api/municipalities/${municipalityCode}/admin-dongs`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`cost_api_error:${res.status}`);
    const data: { dong_code: string | null; dong_name: string; population: number | null; area_km2: number | null }[] = await res.json();
    dongs = data.map((d) => ({
      dongCode: d.dong_code,
      dongName: d.dong_name,
      population: d.population,
      areaKm2: d.area_km2,
    }));
  } catch {
    /* COST API 불가 — contractor 기존 admin_dongs 로 대체 */
    if (!session.contractorId) {
      return NextResponse.json({ error: 'cost_api_unreachable' }, { status: 503 });
    }
    const dbDongs = await prisma.adminDong.findMany({
      where: { contractorId: BigInt(session.contractorId) },
      orderBy: { dongName: 'asc' },
      select: { dongCode: true, dongName: true, population: true, areaKm2: true },
    });
    if (dbDongs.length === 0) {
      return NextResponse.json({ error: 'cost_api_unreachable' }, { status: 503 });
    }
    dongs = dbDongs.map((d) => ({
      dongCode: d.dongCode,
      dongName: d.dongName,
      population: d.population,
      areaKm2: d.areaKm2 ? Number(d.areaKm2) : null,
    }));
    return NextResponse.json({ municipalityCode, dongs, source: 'db' });
  }

  return NextResponse.json({ municipalityCode, dongs });
}
