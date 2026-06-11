/**
 * GET  /api/waste-records?from=YYYY-MM-DD&to=YYYY-MM-DD&material=
 * POST /api/waste-records — upsert (contractorId+date+material 유니크)
 *   body: { recordDate, materialCode, weightTon, note? }
 *
 * 작업자(WORKER)도 입력 가능 — 본인 위탁업체 기록만
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  recordDate: z.string(),
  materialCode: z.string().min(1).max(20),
  weightTon: z.number().min(0).max(99_999),
  note: z.string().max(500).optional(),
  disposalSiteId: z.string().nullable().optional(),
});

function contractorScope(session: { role: string; contractorId: string | null; municipalityId: string | null }) {
  if (session.role === 'SUPER_ADMIN') return {} as Prisma.WasteTreatmentRecordWhereInput;
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  return { id: BigInt(-1) };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const material = url.searchParams.get('material');

  const where: Prisma.WasteTreatmentRecordWhereInput = { ...contractorScope(session) };
  if (from && to) where.recordDate = { gte: new Date(from), lte: new Date(to) };
  if (material) where.materialCode = material;

  const items = await prisma.wasteTreatmentRecord.findMany({
    where,
    include: {
      recorder: { select: { id: true, name: true, role: true } },
      disposalSite: { select: { id: true, name: true } },
    },
    orderBy: [{ recordDate: 'desc' }, { materialCode: 'asc' }],
    take: 1000,
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id.toString(),
      recordDate: r.recordDate.toISOString().slice(0, 10),
      materialCode: r.materialCode,
      weightTon: Number(r.weightTon.toString()),
      note: r.note,
      disposalSiteId: r.disposalSiteId?.toString() ?? null,
      disposalSiteName: r.disposalSite?.name ?? null,
      recorderId: r.recordedBy.toString(),
      recorderName: r.recorder.name,
      recorderRole: r.recorder.role,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'MUNI_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const contractorId = BigInt(session.contractorId);
  const recordDate = new Date(b.recordDate);

  /* disposalSiteId 가시범위 검증 */
  let disposalSiteIdBig: bigint | null = null;
  if (b.disposalSiteId) {
    const site = await prisma.disposalSite.findFirst({
      where: { id: BigInt(b.disposalSiteId), contractorId, isActive: true },
      select: { id: true },
    });
    if (!site) return NextResponse.json({ error: 'invalid_disposal_site' }, { status: 400 });
    disposalSiteIdBig = site.id;
  }

  const upserted = await prisma.wasteTreatmentRecord.upsert({
    where: { contractorId_recordDate_materialCode: { contractorId, recordDate, materialCode: b.materialCode } },
    create: {
      contractorId, recordDate,
      materialCode: b.materialCode,
      weightTon: b.weightTon,
      note: b.note ?? null,
      disposalSiteId: disposalSiteIdBig,
      recordedBy: BigInt(session.userId),
    },
    update: {
      weightTon: b.weightTon,
      note: b.note ?? null,
      disposalSiteId: disposalSiteIdBig,
      recordedBy: BigInt(session.userId),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'WASTE_RECORD_UPSERT',
      resourceType: 'waste_treatment_record',
      resourceId: upserted.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { date: b.recordDate, material: b.materialCode, weight: b.weightTon } as object,
    },
  });

  return NextResponse.json({ ok: true, id: upserted.id.toString() });
}
