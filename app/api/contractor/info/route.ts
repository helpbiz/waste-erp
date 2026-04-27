/**
 * GET   /api/contractor/info — 본인 위탁업체 정보 (차고지 포함)
 * PATCH /api/contractor/info — 회사정보·차고지 수정 (CONTRACTOR_ADMIN+)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

export const runtime = 'nodejs';

const Patch = z.object({
  ceoName: z.string().max(50).nullable().optional(),
  phoneMain: z.string().max(20).nullable().optional(),
  emailMain: z.string().max(100).nullable().optional(),
  garageAddress: z.string().max(255).nullable().optional(),
  garageLat: z.number().min(-90).max(90).nullable().optional(),
  garageLng: z.number().min(-180).max(180).nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!session.contractorId) return NextResponse.json({ contractor: null });

  const c = await prisma.contractor.findUnique({
    where: { id: BigInt(session.contractorId) },
    include: { municipality: { select: { name: true, code: true } } },
  });
  if (!c) return NextResponse.json({ contractor: null });

  return NextResponse.json({
    contractor: {
      id: c.id.toString(),
      companyName: c.companyName,
      businessNo: c.businessNo,
      municipalityName: c.municipality.name,
      ceoName: c.ceoName,
      phoneMain: c.phoneMain,
      emailMain: c.emailMain,
      garageAddress: c.garageAddress,
      garageLat: c.garageLat ? Number(c.garageLat.toString()) : null,
      garageLng: c.garageLng ? Number(c.garageLng.toString()) : null,
      contractStart: c.contractStart?.toISOString().slice(0, 10) ?? null,
      contractEnd: c.contractEnd?.toISOString().slice(0, 10) ?? null,
      status: c.status,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;

  await prisma.contractor.update({
    where: { id: BigInt(session.contractorId) },
    data: {
      ...(b.ceoName !== undefined ? { ceoName: b.ceoName } : {}),
      ...(b.phoneMain !== undefined ? { phoneMain: b.phoneMain } : {}),
      ...(b.emailMain !== undefined ? { emailMain: b.emailMain } : {}),
      ...(b.garageAddress !== undefined ? { garageAddress: b.garageAddress } : {}),
      ...(b.garageLat !== undefined ? { garageLat: b.garageLat } : {}),
      ...(b.garageLng !== undefined ? { garageLng: b.garageLng } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'CONTRACTOR_INFO_UPDATE',
      resourceType: 'contractor',
      resourceId: session.contractorId,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { fields: Object.keys(b) } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
