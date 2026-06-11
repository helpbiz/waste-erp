/**
 * GET /api/tbm/my-history — 나의 TBM 서명이력 (WORKER)
 * Query: year=2026
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function parseTbmContent(raw: string | null): { text: string | null } {
  if (!raw) return { text: null };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return { text: p.text ?? null };
  } catch { /* ignore */ }
  return { text: raw };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const yearRaw = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  if (!Number.isInteger(yearRaw) || yearRaw < 2020 || yearRaw > 2100) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }
  const year = yearRaw;
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const sigs = await prisma.tbmSignature.findMany({
    where: {
      workerId: BigInt(session.userId),
      session: { sessionDate: { gte: from, lt: to } },
    },
    include: {
      session: {
        include: {
          creator: { select: { name: true } },
          facility: { select: { name: true } },
        },
      },
    },
    orderBy: { signedAt: 'desc' },
  });

  return NextResponse.json({
    year,
    total: sigs.length,
    items: sigs.map((sig) => {
      const parsed = parseTbmContent(sig.session.content ?? null);
      return {
        id: sig.id.toString(),
        sessionId: sig.session.id.toString(),
        sessionDate: sig.session.sessionDate.toISOString().slice(0, 10),
        topic: sig.session.topic,
        content: parsed.text,
        department: sig.session.department ?? null,
        facilityName: sig.session.facility?.name ?? null,
        createdBy: sig.session.creator.name,
        signedAt: sig.signedAt.toISOString(),
      };
    }),
  });
}
