/**
 * GET  /api/dashboard/wall/settings — 현재 wall 셋팅 (기본값 머지) 반환
 * PATCH /api/dashboard/wall/settings — 회사 admin 이 자기 회사 셋팅 갱신
 *
 * 저장 위치: ContractorFeature(featureKey='nocAccess').config (Json)
 *  - DB 변경 0건 (기존 ContractorFeature.config 컬럼 활용)
 *
 * 권한 (Phase 2A):
 *  - SUPER_ADMIN: 모든 회사 (`?contractorId=N` 또는 자기 contractorId 없으면 글로벌 메모리 — 미지원)
 *  - CONTRACTOR_ADMIN/INTERNAL_ADMIN: 자기 회사 nocAccess 활성 시
 *  - WORKER/MUNI: 차단
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { hasFeature } from '@/lib/features';

export const runtime = 'nodejs';

const Settings = z.object({
  monitorSize: z.enum(['32', '40', '50', 'auto']).default('32'),
  showComplaintsKpi: z.boolean().default(true),
  showOpsKpi: z.boolean().default(true),
  showFacilities: z.boolean().default(true),
  showRecentComplaints: z.boolean().default(true),
  refreshInterval: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(300)]).default(30),
  displayName: z.string().max(50).nullable().optional(),
});
type WallSettings = z.infer<typeof Settings>;

const DEFAULTS: WallSettings = {
  monitorSize: '32',
  showComplaintsKpi: true,
  showOpsKpi: true,
  showFacilities: true,
  showRecentComplaints: true,
  refreshInterval: 30,
  displayName: null,
};

/* ─────────── 권한 헬퍼 ─────────── */

async function resolveContractorId(req: Request, session: Awaited<ReturnType<typeof readSession>>) {
  if (!session) return null;
  if (session.role === 'WORKER') return null;

  const url = new URL(req.url);
  const queryCid = url.searchParams.get('contractorId');

  if (session.role === 'SUPER_ADMIN') {
    return queryCid ? BigInt(queryCid) : (session.contractorId ? BigInt(session.contractorId) : null);
  }
  if (!session.contractorId) return null;
  /* CONTRACTOR_ADMIN/INTERNAL_ADMIN: 자기 회사 강제 */
  return BigInt(session.contractorId);
}

async function checkAdminPerm(session: Awaited<ReturnType<typeof readSession>>): Promise<boolean> {
  if (!session) return false;
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'].includes(session.role);
}

/* ─────────── GET ─────────── */

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!(await checkAdminPerm(session))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* MUNI_ADMIN: MuniAccessPolicy.wallConfig 에서 로드 */
  if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ settings: DEFAULTS });
    const policy = await prisma.muniAccessPolicy.findUnique({
      where: { municipalityId: BigInt(session.municipalityId) },
      select: { wallConfig: true },
    });
    const stored = (policy?.wallConfig && typeof policy.wallConfig === 'object' && !Array.isArray(policy.wallConfig))
      ? (policy.wallConfig as Record<string, unknown>) : {};
    return NextResponse.json({ settings: { ...DEFAULTS, ...(stored as Partial<WallSettings>) } });
  }

  const cId = await resolveContractorId(req, session);
  if (!cId) return NextResponse.json({ settings: DEFAULTS, contractorId: null });

  /* nocAccess 활성 검증 (SUPER_ADMIN 제외) */
  if (session.role !== 'SUPER_ADMIN') {
    const enabled = await hasFeature(cId, 'nocAccess');
    if (!enabled) return NextResponse.json({ error: 'noc_disabled' }, { status: 403 });
  }

  const row = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId: cId, featureKey: 'nocAccess' } },
    select: { config: true },
  });
  const stored = (row?.config && typeof row.config === 'object' && !Array.isArray(row.config))
    ? (row.config as Record<string, unknown>) : {};
  const merged: WallSettings = { ...DEFAULTS, ...(stored as Partial<WallSettings>) };
  return NextResponse.json({ settings: merged, contractorId: cId.toString() });
}

/* ─────────── PATCH ─────────── */

export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!(await checkAdminPerm(session))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  /* MUNI_ADMIN: MuniAccessPolicy.wallConfig 에 저장 */
  if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return NextResponse.json({ error: 'no_municipality' }, { status: 400 });
    const parsed = Settings.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    const muniId = BigInt(session.municipalityId);
    const existing = await prisma.muniAccessPolicy.findUnique({
      where: { municipalityId: muniId }, select: { wallConfig: true },
    });
    const current = (existing?.wallConfig && typeof existing.wallConfig === 'object' && !Array.isArray(existing.wallConfig))
      ? (existing.wallConfig as Record<string, unknown>) : {};
    const next = { ...DEFAULTS, ...current, ...parsed.data };
    await prisma.muniAccessPolicy.upsert({
      where: { municipalityId: muniId },
      create: { municipalityId: muniId, wallConfig: next, updatedBy: BigInt(session.userId) },
      update: { wallConfig: next, updatedBy: BigInt(session.userId) },
    });
    return NextResponse.json({ ok: true, settings: next });
  }

  const cId = await resolveContractorId(req, session);
  if (!cId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  /* nocAccess 활성 검증 (SUPER_ADMIN 제외) */
  if (session.role !== 'SUPER_ADMIN') {
    const enabled = await hasFeature(cId, 'nocAccess');
    if (!enabled) return NextResponse.json({ error: 'noc_disabled' }, { status: 403 });
  }

  const parsed = Settings.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  /* 기존 config 와 머지 */
  const existing = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId: cId, featureKey: 'nocAccess' } },
    select: { id: true, enabled: true, config: true },
  });
  const current = (existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config))
    ? (existing.config as Record<string, unknown>) : {};
  const next = { ...DEFAULTS, ...current, ...parsed.data };

  await prisma.contractorFeature.upsert({
    where: { contractorId_featureKey: { contractorId: cId, featureKey: 'nocAccess' } },
    create: {
      contractorId: cId,
      featureKey: 'nocAccess',
      enabled: existing?.enabled ?? true,
      config: next,
      updatedBy: BigInt(session.userId),
    },
    update: {
      config: next,
      updatedBy: BigInt(session.userId),
    },
  });

  return NextResponse.json({ ok: true, settings: next });
}
