/**
 * P2-4: 조직 트리 — 헬프비즈 → 지자체 → 위탁업체 → 직원 카운트.
 * 페이지 첫 로드 시 사이즈 안전을 위해 직원 명단은 카운트만, 상세는 별도 호출.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [munis, contractors, users] = await Promise.all([
    prisma.municipality.findMany({
      where: { contractors: { some: {} } }, // 위탁업체가 1개 이상 매핑된 지자체만
      select: { id: true, name: true, code: true, region: true, status: true },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
    }),
    prisma.contractor.findMany({
      select: { id: true, municipalityId: true, companyName: true, status: true },
      orderBy: { companyName: 'asc' },
    }),
    prisma.user.groupBy({
      by: ['contractorId', 'role'],
      _count: { _all: true },
      where: { contractorId: { not: null } },
    }),
  ]);

  /* contractorId × role → count 맵 */
  const userMap = new Map<string, Record<string, number>>();
  for (const u of users) {
    if (!u.contractorId) continue;
    const k = u.contractorId.toString();
    const cur = userMap.get(k) ?? {};
    cur[u.role] = u._count._all;
    userMap.set(k, cur);
  }

  /* MUNI_ADMIN — 회사 소속 없음, municipality 기준 카운트 */
  const muniAdmins = await prisma.user.groupBy({
    by: ['municipalityId'],
    _count: { _all: true },
    where: { role: 'MUNI_ADMIN', municipalityId: { not: null } },
  });
  const muniAdminMap = new Map<string, number>();
  for (const m of muniAdmins) {
    if (m.municipalityId) muniAdminMap.set(m.municipalityId.toString(), m._count._all);
  }

  /* SUPER_ADMIN 카운트 */
  const superAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });

  /* contractor 별 묶기 */
  const contractorByMuni = new Map<string, Array<{ id: string; name: string; status: string; counts: Record<string, number> }>>();
  for (const c of contractors) {
    const k = c.municipalityId.toString();
    const list = contractorByMuni.get(k) ?? [];
    list.push({
      id: c.id.toString(),
      name: c.companyName,
      status: c.status,
      counts: userMap.get(c.id.toString()) ?? {},
    });
    contractorByMuni.set(k, list);
  }

  return NextResponse.json({
    superAdminCount,
    municipalities: munis.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      code: m.code,
      region: m.region,
      status: m.status,
      muniAdmins: muniAdminMap.get(m.id.toString()) ?? 0,
      contractors: contractorByMuni.get(m.id.toString()) ?? [],
    })),
  });
}
