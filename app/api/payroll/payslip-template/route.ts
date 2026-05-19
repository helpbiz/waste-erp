/**
 * GET  /api/payroll/payslip-template — 회사 급여명세 컬럼 설정 조회
 * PUT  /api/payroll/payslip-template — 저장 (ContractorFeature.config 재활용)
 *
 * config JSON 구조:
 *   { earnings: [{key, label, required}], deductions: [{key, label, required}] }
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { DEFAULT_TEMPLATE, type PayslipTemplate } from '@/lib/payslip-template';

const ColumnSchema = z.object({
  key:      z.string().min(1).max(30),
  label:    z.string().min(1).max(30),
  required: z.boolean(),
});
const PutBody = z.object({
  earnings:       z.array(ColumnSchema).min(1).max(20),
  deductions:     z.array(ColumnSchema).min(1).max(20),
  extras:         z.array(ColumnSchema).max(10).optional(),
  showWorkHours:  z.boolean().optional(),
  showCalcMethod: z.boolean().optional(),
  payDayLabel:    z.string().max(50).optional(),
  footer:         z.string().max(300).optional(),
  contractorId: z.union([z.string(), z.number()]).optional(),
});

async function resolveContractorId(session: Awaited<ReturnType<typeof readSession>>, rawCid?: string | number): Promise<bigint | null> {
  if (!session) return null;
  if (session.role === 'SUPER_ADMIN') {
    if (!rawCid) return null;
    return BigInt(rawCid);
  }
  return session.contractorId ? BigInt(session.contractorId) : null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const rawCid = url.searchParams.get('contractorId') ?? undefined;
  const contractorId = await resolveContractorId(session, rawCid);
  if (!contractorId) return NextResponse.json({ error: 'contractor_required' }, { status: 400 });

  const row = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId, featureKey: 'payslip' } },
    select: { config: true },
  });

  const template = (row?.config as PayslipTemplate | null) ?? DEFAULT_TEMPLATE;
  return NextResponse.json({ template });
}

export async function PUT(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const isManagerRole = canManageUsers(session.role);
  let workerIsPayrollManager = false;
  if (!isManagerRole && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isPayrollManager: true } });
    workerIsPayrollManager = flag?.isPayrollManager === true;
  }
  if (!isManagerRole && !workerIsPayrollManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { earnings, deductions, extras, showWorkHours, showCalcMethod, payDayLabel, footer, contractorId: rawCid } = parsed.data;
  const contractorId = await resolveContractorId(session, rawCid);
  if (!contractorId) return NextResponse.json({ error: 'contractor_required' }, { status: 400 });

  const existing = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId, featureKey: 'payslip' } },
    select: { config: true },
  });
  const prev = (existing?.config as PayslipTemplate | null) ?? DEFAULT_TEMPLATE;

  const config: PayslipTemplate = {
    earnings,
    deductions,
    extras:         extras         ?? prev.extras,
    showWorkHours:  showWorkHours  ?? prev.showWorkHours,
    showCalcMethod: showCalcMethod ?? prev.showCalcMethod,
    payDayLabel:    payDayLabel    ?? prev.payDayLabel,
    footer:         footer         ?? prev.footer,
  };
  await prisma.contractorFeature.upsert({
    where: { contractorId_featureKey: { contractorId, featureKey: 'payslip' } },
    update:  { config: config as object, enabled: true, updatedBy: BigInt(session.userId) },
    create:  { contractorId, featureKey: 'payslip', enabled: true, config: config as object, updatedBy: BigInt(session.userId) },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId), actorRole: session.role,
      action: 'PAYSLIP_TEMPLATE_UPDATE', resourceType: 'contractor_feature',
      resourceId: contractorId.toString(),
      contractorId,
      metadata: { earningsCount: earnings.length, deductionsCount: deductions.length } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
