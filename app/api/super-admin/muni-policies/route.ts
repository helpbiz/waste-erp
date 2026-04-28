/**
 * GET  /api/super-admin/muni-policies — 모든 지자체 + 정책
 * POST /api/super-admin/muni-policies — upsert
 *   body: { municipalityId, allowedScreens, allowedReports, exportEnabled, bulkExportEnabled, note? }
 *
 * 권한: SUPER_ADMIN 전용
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const Body = z.object({
  municipalityId: z.string(),
  allowedScreens: z.array(z.string()).max(50),
  allowedReports: z.array(z.string()).max(50),
  exportEnabled: z.boolean().optional(),
  bulkExportEnabled: z.boolean().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const munis = await prisma.municipality.findMany({
    include: {
      accessPolicy: true,
      _count: { select: { contractors: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    items: munis.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      code: m.code,
      region: m.region ?? null, // Plan SC-02 — Tab 2 계층 그룹핑 키
      status: m.status,
      contractorCount: m._count.contractors,
      policy: m.accessPolicy ? {
        allowedScreens: m.accessPolicy.allowedScreens.split(',').filter(Boolean),
        allowedReports: m.accessPolicy.allowedReports.split(',').filter(Boolean),
        exportEnabled: m.accessPolicy.exportEnabled,
        bulkExportEnabled: m.accessPolicy.bulkExportEnabled,
        note: m.accessPolicy.note,
        updatedAt: m.accessPolicy.updatedAt.toISOString(),
      } : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const b = parsed.data;
  const municipalityId = BigInt(b.municipalityId);

  const upserted = await prisma.muniAccessPolicy.upsert({
    where: { municipalityId },
    create: {
      municipalityId,
      allowedScreens: b.allowedScreens.join(','),
      allowedReports: b.allowedReports.join(','),
      exportEnabled: b.exportEnabled ?? true,
      bulkExportEnabled: b.bulkExportEnabled ?? false,
      note: b.note ?? null,
      updatedBy: BigInt(session.userId),
    },
    update: {
      allowedScreens: b.allowedScreens.join(','),
      allowedReports: b.allowedReports.join(','),
      exportEnabled: b.exportEnabled ?? true,
      bulkExportEnabled: b.bulkExportEnabled ?? false,
      note: b.note ?? null,
      updatedBy: BigInt(session.userId),
    },
  });

  /* SUPER cross-tenant — 정책 변경 대상 muni 명시 기록 */
  await writeAudit(req, session, {
    action: 'MUNI_POLICY_SET',
    resourceType: 'muni_access_policy',
    resourceId: upserted.id.toString(),
    municipalityId,
    metadata: {
      municipalityId: b.municipalityId,
      screens: b.allowedScreens.length,
      reports: b.allowedReports.length,
      crossTenant: true,
    },
  });

  return NextResponse.json({ ok: true });
}
