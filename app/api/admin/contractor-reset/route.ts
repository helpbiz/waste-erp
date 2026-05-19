/**
 * POST /api/admin/contractor-reset
 * 테스트 데이터 전체 초기화 — 차량등록·인원등록·출퇴근제한설정은 보존
 * 삭제 대상: 근태기록, 차량일지, 민원, 안전보고, 휴가신청, 급여명세, 공지사항, 실적, 감사로그
 *
 * SUPER_ADMIN: contractorId 지정 필수
 * CONTRACTOR_ADMIN: 본인 회사만 (contractorId 자동)
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

const Body = z.object({
  contractorId: z.union([z.string(), z.number()]).optional(),
  confirm: z.literal('RESET'),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const isSuperAdmin    = session.role === 'SUPER_ADMIN';
  const isContractorAdm = session.role === 'CONTRACTOR_ADMIN';
  if (!isSuperAdmin && !isContractorAdm) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', detail: '{ contractorId?, confirm: "RESET" } 필요' }, { status: 400 });
  }

  let contractorId: bigint;
  if (isSuperAdmin) {
    if (!parsed.data.contractorId) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    contractorId = BigInt(parsed.data.contractorId);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  /* 트랜잭션으로 일괄 삭제 — 순서: FK 의존성 낮은 것부터 */
  const [
    attendance, vehicleLogs, complaints, safety, leave, payslip, announce, audit,
  ] = await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { contractorId } }),
    prisma.vehicleLog.deleteMany({ where: { vehicle: { contractorId } } }),
    prisma.complaint.deleteMany({ where: { contractorId } }),
    prisma.safetyReport.deleteMany({ where: { contractorId } }),
    prisma.leaveRequest.deleteMany({ where: { worker: { contractorId } } }),
    prisma.payslipRecord.deleteMany({ where: { contractorId } }),
    prisma.announcement.deleteMany({ where: { contractorId } }),
    prisma.auditLog.deleteMany({ where: { contractorId } }),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: {
      attendance:  attendance.count,
      vehicleLogs: vehicleLogs.count,
      complaints:  complaints.count,
      safety:      safety.count,
      leave:       leave.count,
      payslip:     payslip.count,
      announce:    announce.count,
      auditLog:    audit.count,
    },
  });
}
