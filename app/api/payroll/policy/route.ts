/**
 * GET  /api/payroll/policy  — 급여 정책 조회 (결재승인권자 후보 포함)
 * PUT  /api/payroll/policy  — 급여 정책 저장/수정
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { DEFAULT_POLICY } from '@/lib/payroll-policy';

/* P2-2: SUPER_ADMIN/MUNI_ADMIN은 ?contractorId= 필수 */
async function resolveContractorId(
  session: Awaited<ReturnType<typeof readSession>>,
  cidParam: string | null,
): Promise<bigint | null | 'missing' | 'invalid' | 'forbidden'> {
  if (!session) return null;
  if (session.role === 'SUPER_ADMIN' || session.role === 'MUNI_ADMIN') {
    if (!cidParam) return 'missing';
    const cid = (() => { try { return BigInt(cidParam); } catch { return null; } })();
    if (!cid) return 'invalid';
    if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
      const c = await prisma.contractor.findUnique({ where: { id: cid }, select: { municipalityId: true } });
      if (!c || c.municipalityId.toString() !== session.municipalityId) return 'forbidden';
    }
    return cid;
  }
  return session.contractorId ? BigInt(session.contractorId) : null;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const cidParam = new URL(req.url).searchParams.get('contractorId');
  const contractorId = await resolveContractorId(session, cidParam);
  if (contractorId === 'missing') return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
  if (contractorId === 'invalid') return NextResponse.json({ error: 'invalid_contractor_id' }, { status: 400 });
  if (contractorId === 'forbidden') return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
  if (!contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const [row, candidates] = await Promise.all([
    prisma.payrollPolicy.findUnique({ where: { contractorId } }),
    prisma.user.findMany({
      where: {
        contractorId,
        role: { in: ['INTERNAL_ADMIN', 'CONTRACTOR_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({
    policy: row
      ? {
          dailyWorkHours:    Number(row.dailyWorkHours),
          nightStartHour:    row.nightStartHour,
          nightEndHour:      row.nightEndHour,
          overtimeMultiplier: Number(row.overtimeMultiplier),
          nightMultiplier:   Number(row.nightMultiplier),
          holidayMultiplier: Number(row.holidayMultiplier),
          payslipApproverId: row.payslipApproverId?.toString() ?? null,
        }
      : DEFAULT_POLICY,
    approverCandidates: candidates.map((u) => ({
      id:   u.id.toString(),
      name: u.name,
      role: u.role,
    })),
  });
}

export async function PUT(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isManager = canManageUsers(session.role);
  if (!isManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const cidParam = new URL(req.url).searchParams.get('contractorId');
  const contractorId = await resolveContractorId(session, cidParam);
  if (contractorId === 'missing') return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
  if (contractorId === 'invalid') return NextResponse.json({ error: 'invalid_contractor_id' }, { status: 400 });
  if (contractorId === 'forbidden') return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
  if (!contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const {
    dailyWorkHours, nightStartHour, nightEndHour,
    overtimeMultiplier, nightMultiplier, holidayMultiplier,
    payslipApproverId,
  } = body;

  if (
    typeof dailyWorkHours !== 'number' || dailyWorkHours < 1 || dailyWorkHours > 12 ||
    typeof nightStartHour !== 'number' || nightStartHour < 0 || nightStartHour > 23 ||
    typeof nightEndHour !== 'number'   || nightEndHour < 0   || nightEndHour > 23 ||
    typeof overtimeMultiplier !== 'number' || overtimeMultiplier < 1 || overtimeMultiplier > 3 ||
    typeof nightMultiplier !== 'number'    || nightMultiplier < 0   || nightMultiplier > 2 ||
    typeof holidayMultiplier !== 'number'  || holidayMultiplier < 1 || holidayMultiplier > 3
  ) {
    return NextResponse.json({ error: 'invalid_values' }, { status: 422 });
  }

  /* 승인권자 — null 또는 해당 업체 소속 관리자 */
  let approverIdBigInt: bigint | null = null;
  if (payslipApproverId != null && payslipApproverId !== '') {
    approverIdBigInt = BigInt(payslipApproverId);
    const approver = await prisma.user.findUnique({
      where: { id: approverIdBigInt },
      select: { contractorId: true, role: true },
    });
    if (!approver || approver.contractorId !== contractorId) {
      return NextResponse.json({ error: 'invalid_approver' }, { status: 422 });
    }
  }

  const updated = await prisma.payrollPolicy.upsert({
    where: { contractorId },
    create: {
      contractorId, dailyWorkHours, nightStartHour, nightEndHour,
      overtimeMultiplier, nightMultiplier, holidayMultiplier,
      payslipApproverId: approverIdBigInt,
      updatedBy: BigInt(session.userId),
    },
    update: {
      dailyWorkHours, nightStartHour, nightEndHour,
      overtimeMultiplier, nightMultiplier, holidayMultiplier,
      payslipApproverId: approverIdBigInt,
      updatedBy: BigInt(session.userId),
    },
  });

  return NextResponse.json({
    policy: {
      dailyWorkHours:    Number(updated.dailyWorkHours),
      nightStartHour:    updated.nightStartHour,
      nightEndHour:      updated.nightEndHour,
      overtimeMultiplier: Number(updated.overtimeMultiplier),
      nightMultiplier:   Number(updated.nightMultiplier),
      holidayMultiplier: Number(updated.holidayMultiplier),
      payslipApproverId: updated.payslipApproverId?.toString() ?? null,
    },
  });
}
