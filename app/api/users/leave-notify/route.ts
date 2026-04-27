/**
 * GET  /api/users/leave-notify — 잔여 0 워커 미리보기 (대상 추출)
 * POST /api/users/leave-notify — 잔여 0 워커에게 SMS 발송 (월초 부여 알림)
 *
 * 대상: 가시범위 내 ACTIVE WORKER 중,
 *  (a) 올해 AnnualLeaveBalance 미생성, 또는
 *  (b) 잔여 = granted + carriedOver - used <= 0
 *
 * Plan §3-1: SUPER/CONTRACTOR/INTERNAL 만 발송 가능.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { userScope, canManageUsers, recommendedAnnualLeaveDays, leaveRemaining } from '@/lib/users';
import { getSmsProvider, type SmsRecipient } from '@/lib/sms';

export const runtime = 'nodejs';

type Candidate = {
  id: string;
  name: string;
  employeeNo: string | null;
  phone: string | null;
  hireDate: string | null;
  recommendDays: number;
  reason: 'NO_BALANCE' | 'EXHAUSTED';
  remaining: number;
};

async function findCandidates(session: { role: 'SUPER_ADMIN' | 'MUNI_ADMIN' | 'CONTRACTOR_ADMIN' | 'INTERNAL_ADMIN' | 'WORKER'; contractorId: string | null; municipalityId: string | null }, year: number): Promise<Candidate[]> {
  const workers = await prisma.user.findMany({
    where: { ...userScope(session), role: 'WORKER', status: 'ACTIVE' },
    include: { leaveBalances: { where: { year }, take: 1 } },
    orderBy: { name: 'asc' },
  });

  const out: Candidate[] = [];
  for (const w of workers) {
    const recommend = recommendedAnnualLeaveDays(w.hireDate);
    const balance = w.leaveBalances[0];
    if (!balance) {
      out.push({
        id: w.id.toString(),
        name: w.name,
        employeeNo: w.employeeNo,
        phone: w.phone,
        hireDate: w.hireDate?.toISOString().slice(0, 10) ?? null,
        recommendDays: recommend.days,
        reason: 'NO_BALANCE',
        remaining: 0,
      });
      continue;
    }
    const remaining = leaveRemaining(balance);
    if (remaining <= 0) {
      out.push({
        id: w.id.toString(),
        name: w.name,
        employeeNo: w.employeeNo,
        phone: w.phone,
        hireDate: w.hireDate?.toISOString().slice(0, 10) ?? null,
        recommendDays: recommend.days,
        reason: 'EXHAUSTED',
        remaining,
      });
    }
  }
  return out;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());

  const items = await findCandidates(session, year);
  return NextResponse.json({ year, candidates: items });
}

const PostBody = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  workerIds: z.array(z.string()).optional(),
  message: z.string().min(10).max(300).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const year = parsed.data.year ?? new Date().getFullYear();
  const dryRun = parsed.data.dryRun ?? false;

  let candidates = await findCandidates(session, year);
  if (parsed.data.workerIds && parsed.data.workerIds.length > 0) {
    const set = new Set(parsed.data.workerIds);
    candidates = candidates.filter((c) => set.has(c.id));
  }

  /* phone 없는 대상은 발송 불가 — separately 표시 */
  const phoneless = candidates.filter((c) => !c.phone);
  const sendable = candidates.filter((c) => c.phone);

  const recipients: SmsRecipient[] = sendable.map((c) => ({
    type: 'WORKER',
    name: c.name,
    phone: c.phone,
  }));

  const tpl = parsed.data.message
    ?? `[CleanERP] ${year}년 연차 부여를 확인해주세요. 잔여가 부족하거나 미부여 상태입니다. 관리자에게 문의 바랍니다.`;

  let smsResult: { provider: string; sent: number; failed: number; details: Array<unknown> } = {
    provider: 'NONE', sent: 0, failed: 0, details: [],
  };
  if (!dryRun && recipients.length > 0) {
    const provider = getSmsProvider();
    smsResult = await provider.send(recipients, tpl);
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'LEAVE_BALANCE_NOTIFY',
      resourceType: 'user',
      resourceId: '*',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        year,
        dryRun,
        candidateCount: candidates.length,
        sendableCount: sendable.length,
        phonelessCount: phoneless.length,
        provider: smsResult.provider,
        sent: smsResult.sent,
        failed: smsResult.failed,
        message: tpl,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    year,
    dryRun,
    candidates: {
      total: candidates.length,
      sendable: sendable.length,
      phoneless: phoneless.map((c) => ({ id: c.id, name: c.name, employeeNo: c.employeeNo, reason: c.reason })),
    },
    sms: smsResult,
  });
}
