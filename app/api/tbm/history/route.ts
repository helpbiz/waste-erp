/**
 * GET /api/tbm/history — TBM 활동이력 목록 (관리자 전용)
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, page=1, limit=50
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(role);
}

function parseTbmContent(raw: string | null): { text: string | null; photoDataUrl: string | null } {
  if (!raw) return { text: null, photoDataUrl: null };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return { text: p.text ?? null, photoDataUrl: p.photoDataUrl ?? null };
  } catch { /* ignore */ }
  return { text: raw, photoDataUrl: null };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  /* MUNI_ADMIN: municipalityId 기반 산하 업체 전체 TBM 조회 */
  const isMuni = session.role === 'MUNI_ADMIN';
  if (!isMuni && !session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) { const d = new Date(to); d.setDate(d.getDate() + 1); dateFilter.lte = d; }

  /* 범위 조건 — MUNI_ADMIN은 산하 업체 전체, 그 외는 본인 업체 */
  const scopeWhere = isMuni && session.municipalityId
    ? { contractor: { municipalityId: BigInt(session.municipalityId) } }
    : { contractorId: BigInt(session.contractorId!) };

  const [sessions, total] = await Promise.all([
    prisma.tbmSession.findMany({
      where: {
        ...scopeWhere,
        ...(Object.keys(dateFilter).length > 0 ? { sessionDate: dateFilter } : {}),
      },
      include: {
        creator: { select: { name: true } },
        signatures: {
          include: { worker: { select: { id: true, name: true, employeeNo: true } } },
          orderBy: { signedAt: 'asc' },
        },
        facility: { select: { name: true } },
      },
      orderBy: { sessionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tbmSession.count({
      where: {
        ...scopeWhere,
        ...(Object.keys(dateFilter).length > 0 ? { sessionDate: dateFilter } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    limit,
    sessions: sessions.map((s) => {
      const parsed = parseTbmContent(s.content ?? null);
      return {
        id: s.id.toString(),
        sessionDate: s.sessionDate.toISOString().slice(0, 10),
        topic: s.topic,
        content: parsed.text,
        department: s.department ?? null,
        facilityName: s.facility?.name ?? null,
        createdBy: s.creator.name,
        signCount: s.signatures.length,
        signers: s.signatures.map((sig) => ({
          id: sig.worker.id.toString(),
          name: sig.worker.name,
          employeeNo: sig.worker.employeeNo ?? null,
          signedAt: sig.signedAt.toISOString(),
        })),
      };
    }),
  });
}
