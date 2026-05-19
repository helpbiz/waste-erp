/**
 * GET  /api/contractor/zones — 위탁업체 담당구역 목록 (행정동 포함)
 * POST /api/contractor/zones — 담당구역 추가
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getContractorId(session: { role: string; contractorId?: string | null }): string | null {
  if (session.contractorId) return session.contractorId;
  return null;
}

const ALLOWED = new Set(['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'SUPER_ADMIN']);

const PostBody = z.object({
  zoneName: z.string().trim().min(1).max(100),
  zoneCode: z.string().trim().min(1).max(20),
  zoneType: z.enum(['GENERAL', 'FOOD', 'RECYCLING', 'BULKY', 'STREET_CLEANING']),
  areaKm2: z.number().positive().nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const contractorId = getContractorId(session);
  if (!contractorId) return NextResponse.json({ zones: [] });

  const zones = await prisma.cleaningZone.findMany({
    where: { contractorId: BigInt(contractorId) },
    orderBy: { zoneName: 'asc' },
    include: {
      adminDongs: {
        orderBy: { dongName: 'asc' },
        select: { id: true, dongName: true, dongCode: true, population: true, householdCount: true },
      },
    },
  });

  return NextResponse.json({
    zones: zones.map((z) => ({
      id: z.id.toString(),
      zoneName: z.zoneName,
      zoneCode: z.zoneCode,
      zoneType: z.zoneType,
      areaKm2: z.areaKm2 ? Number(z.areaKm2) : null,
      dongs: z.adminDongs.map((d) => ({
        id: d.id.toString(),
        dongName: d.dongName,
        dongCode: d.dongCode,
        population: d.population,
        householdCount: d.householdCount,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ALLOWED.has(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = getContractorId(session);
  if (!contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;

  const existing = await prisma.cleaningZone.findFirst({
    where: { contractorId: BigInt(contractorId), zoneCode: b.zoneCode },
  });
  if (existing) return NextResponse.json({ error: 'zone_code_duplicate' }, { status: 409 });

  const zone = await prisma.cleaningZone.create({
    data: {
      contractorId: BigInt(contractorId),
      zoneName: b.zoneName,
      zoneCode: b.zoneCode,
      zoneType: b.zoneType,
      areaKm2: b.areaKm2 ?? null,
    },
  });

  return NextResponse.json({ id: zone.id.toString() }, { status: 201 });
}
