/**
 * POST /api/contractor/zones/[id]/dongs — 담당 행정동 추가
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PostBody = z.object({
  dongName: z.string().trim().min(1).max(50),
  dongCode: z.string().trim().min(1).max(20),
  population: z.number().int().nonnegative().nullable().optional(),
  householdCount: z.number().int().nonnegative().nullable().optional(),
  areaKm2: z.number().positive().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const zoneId = parseId(params.id);
  const zCid = parseId(session.contractorId);
  if (!zoneId || !zCid) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const zone = await prisma.cleaningZone.findFirst({
    where: { id: zoneId, contractorId: zCid },
    include: { contractor: { select: { municipalityId: true } } },
  });
  if (!zone) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;

  const dup = await prisma.adminDong.findFirst({
    where: { contractorId: zCid, zoneId: zone.id, dongCode: b.dongCode },
  });
  if (dup) return NextResponse.json({ error: 'dong_code_duplicate' }, { status: 409 });

  const dong = await prisma.adminDong.create({
    data: {
      municipalityId: zone.contractor.municipalityId,
      contractorId: zCid,
      zoneId: zone.id,
      dongName: b.dongName,
      dongCode: b.dongCode,
      population: b.population ?? null,
      householdCount: b.householdCount ?? null,
      areaKm2: b.areaKm2 ?? null,
    },
  });

  return NextResponse.json({ id: dong.id.toString() }, { status: 201 });
}
