/**
 * GET /api/tbm/monthly?yearMonth=YYYY-MM&facilityId=N
 * 월별 TBM 세션 전체 조회 (관리자 전용)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

function parseTbmContent(raw: string | null): { text: string | null; photoDataUrl: string | null } {
  if (!raw) return { text: null, photoDataUrl: null };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && ('text' in p || 'photoDataUrl' in p)) {
      return { text: p.text ?? null, photoDataUrl: p.photoDataUrl ?? null };
    }
  } catch {}
  return { text: raw, photoDataUrl: null };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const yearMonth = url.searchParams.get('yearMonth') ?? '';
  const facilityIdParam = url.searchParams.get('facilityId');

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return NextResponse.json({ error: 'invalid_yearMonth' }, { status: 400 });
  }

  const [y, m] = yearMonth.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to   = new Date(Date.UTC(y, m, 1));
  const contractorId = parseId(session.contractorId);
  if (!contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
  const facilityId = parseId(facilityIdParam);

  const [sessions, allWorkers] = await Promise.all([
    prisma.tbmSession.findMany({
    where: {
      contractorId,
      facilityId: facilityId ?? null,
      sessionDate: { gte: from, lt: to },
    },
    include: {
      creator: { select: { name: true } },
      signatures: {
        include: { worker: { select: { id: true, name: true, employeeNo: true } } },
        orderBy: { signedAt: 'asc' },
      },
      audience: { select: { workerId: true } },
    },
    orderBy: { sessionDate: 'asc' },
  }),
  prisma.user.findMany({
    where: {
      contractorId,
      role: 'WORKER',
      status: 'ACTIVE',
      OR: [
        { departmentId: null },
        { department: { excludeFromTbm: false } },
      ],
    },
    select: { id: true, name: true, employeeNo: true },
    orderBy: { name: 'asc' },
  }),
]);

  return NextResponse.json({
    yearMonth,
    workers: allWorkers.map((w) => ({ id: w.id.toString(), name: w.name, employeeNo: w.employeeNo ?? null })),
    sessions: sessions.map((s) => {
      const parsed = parseTbmContent(s.content ?? null);
      return {
        id: s.id.toString(),
        sessionDate: s.sessionDate.toISOString().slice(0, 10),
        topic: s.topic,
        content: parsed.text,
        photoDataUrl: parsed.photoDataUrl,
        department: s.department ?? null,
        createdBy: s.creator.name,
        signCount: s.signatures.length,
        /// 서명대상 프리셋이 있으면 그 workerId 목록만, 없으면 null(=전사 대상, 기존 동작)
        audienceWorkerIds: s.audience.length > 0 ? s.audience.map((a) => a.workerId.toString()) : null,
        signers: s.signatures.map((sig) => ({
          workerId: sig.worker.id.toString(),
          name: sig.worker.name,
          employeeNo: sig.worker.employeeNo ?? null,
          signedAt: sig.signedAt.toISOString(),
          signatureData: sig.signatureData ?? null,
        })),
      };
    }),
  });
}
