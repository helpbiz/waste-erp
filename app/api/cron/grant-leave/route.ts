/**
 * POST /api/cron/grant-leave — 월초 연차 자동 부여
 *
 * 인증: Bearer 토큰 (CRON_SECRET 헤더 비교) — 외부 cron(예: Vercel Cron, K8s CronJob)에서 호출
 * 정책:
 *  - year 미지정 시 현재 연도
 *  - dryRun=true 시 부여 대상만 반환, DB 미변경
 *  - 대상: ACTIVE WORKER + 해당 연도 AnnualLeaveBalance 미존재
 *  - 부여 일수: recommendedAnnualLeaveDays(hireDate)
 *  - 1년 미만(years=0)은 0일이면 스킵 (만근 후 별도 부여)
 *
 * 호출 예시:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        -H "content-type: application/json" \
 *        -d '{"year":2026}' \
 *        https://your.app/api/cron/grant-leave
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { recommendedAnnualLeaveDays, leaveRemaining } from '@/lib/users';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';

const Body = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  dryRun: z.boolean().optional(),
  contractorId: z.string().optional(), // 특정 위탁업체만 (선택)
});

const authorized = isCronAuthorized;

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const year = parsed.data.year ?? new Date().getFullYear();
  const dryRun = parsed.data.dryRun ?? false;

  /* 활성 워커 + (선택) 특정 contractor */
  const where: Record<string, unknown> = { role: 'WORKER', status: 'ACTIVE' };
  if (parsed.data.contractorId) where.contractorId = BigInt(parsed.data.contractorId);

  const workers = await prisma.user.findMany({
    where,
    include: { leaveBalances: { where: { year }, take: 1 } },
  });

  type Plan = {
    workerId: string;
    name: string;
    employeeNo: string | null;
    hireDate: string | null;
    days: number;
    rule: string;
    skip?: 'already_granted' | 'no_recommend';
  };

  const plans: Plan[] = [];
  let granted = 0;
  let skipped = 0;

  for (const w of workers) {
    const recommend = recommendedAnnualLeaveDays(w.hireDate);
    const baseInfo = {
      workerId: w.id.toString(),
      name: w.name,
      employeeNo: w.employeeNo,
      hireDate: w.hireDate?.toISOString().slice(0, 10) ?? null,
      days: recommend.days,
      rule: recommend.rule,
    };
    if (w.leaveBalances.length > 0) {
      plans.push({ ...baseInfo, skip: 'already_granted' });
      skipped++;
      continue;
    }
    if (recommend.days <= 0) {
      plans.push({ ...baseInfo, skip: 'no_recommend' });
      skipped++;
      continue;
    }
    plans.push(baseInfo);
    if (!dryRun) {
      /* 직전년도 잔여 자동 이월 (R5 옵션 — 보수적으로 0으로 시작, 운영시 룰 조정) */
      const prevYear = await prisma.annualLeaveBalance.findUnique({
        where: { workerId_year: { workerId: w.id, year: year - 1 } },
      });
      const carriedOver = prevYear ? Math.max(0, leaveRemaining(prevYear)) : 0;
      await prisma.annualLeaveBalance.create({
        data: {
          workerId: w.id,
          year,
          granted: recommend.days,
          carriedOver,
          note: `[자동부여] ${recommend.rule}${carriedOver > 0 ? ` + 이월 ${carriedOver}일` : ''}`,
        },
      });
      granted++;
    }
  }

  /* 시스템 actor — actor=null 허용 audit 활용. 결재 모델은 사용 안 함 */
  await prisma.auditLog.create({
    data: {
      action: 'CRON_GRANT_LEAVE',
      resourceType: 'system',
      resourceId: `year-${year}`,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        year,
        dryRun,
        candidateCount: workers.length,
        granted,
        skipped,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    year,
    dryRun,
    summary: { candidates: workers.length, granted, skipped },
    plans,
  });
}
