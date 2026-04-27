/**
 * POST /api/safety/weather-alert — 기상악화 알림톡 공지 발송
 *
 *  - 권한: 매니저 (CONTRACTOR_ADMIN, INTERNAL_ADMIN, SUPER_ADMIN)
 *  - SMS provider 추상화 사용 (SIMULATION/SOLAPI/WEBHOOK 자동 전환)
 *  - 카카오 알림톡 호환 — Solapi 알림톡은 동일 text 사용 가능
 *  - 모든 발송 audit_log 기록
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { getSmsProvider, type SmsRecipient } from '@/lib/sms';
import { WEATHER_ALERT_LABEL } from '@/lib/weather-alerts';

export const runtime = 'nodejs';

const Body = z.object({
  type: z.enum(['POKYUM', 'HANPA', 'POKWU', 'POKSEOL', 'GANGPUNG', 'ETC']),
  message: z.string().trim().min(10).max(2000),
  workerIds: z.array(z.union([z.string(), z.number()])).min(1).max(500),
  schedule: z.enum(['IMMEDIATE', 'RESERVED']).optional(),  // 예약은 Phase 1B
});

function isManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!session.contractorId) {
    return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  if (b.schedule === 'RESERVED') {
    return NextResponse.json(
      { error: 'reserved_not_supported', message: '예약발송은 Phase 1B 추가 예정입니다.' },
      { status: 501 }
    );
  }

  const contractorId = BigInt(session.contractorId);
  const ids = b.workerIds.map((id) => BigInt(id));

  /* 본인 위탁업체 소속 워커만 허용 */
  const workers = await prisma.user.findMany({
    where: { id: { in: ids }, contractorId, role: 'WORKER', status: 'ACTIVE' },
    select: { id: true, name: true, phone: true },
  });
  if (workers.length === 0) {
    return NextResponse.json({ error: 'no_valid_recipients' }, { status: 400 });
  }
  if (workers.length !== ids.length) {
    return NextResponse.json(
      { error: 'invalid_recipients', message: '본인 위탁업체 소속 활성 근로자만 선택 가능합니다.' },
      { status: 400 }
    );
  }

  const recipients: SmsRecipient[] = workers.map((w) => ({
    type: 'WORKER',
    name: w.name,
    phone: w.phone ?? null,
  }));

  const provider = getSmsProvider();
  let result;
  try {
    result = await provider.send(recipients, b.message);
  } catch (e) {
    result = {
      provider: provider.name,
      sent: 0,
      failed: recipients.length,
      details: recipients.map((r) => ({
        recipientType: r.type,
        recipientName: r.name,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      })),
    };
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'WEATHER_ALERT_DISPATCH',
      resourceType: 'safety_weather_alert',
      resourceId: contractorId.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        type: b.type,
        typeLabel: WEATHER_ALERT_LABEL[b.type],
        recipientCount: recipients.length,
        provider: result.provider,
        sent: result.sent,
        failed: result.failed,
        messageLen: b.message.length,
      } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    type: b.type,
    typeLabel: WEATHER_ALERT_LABEL[b.type],
    notification: {
      provider: result.provider,
      simulated: result.provider === 'SIMULATION',
      total: recipients.length,
      sent: result.sent,
      failed: result.failed,
      recipients: result.details.map((d) => ({ name: d.recipientName, ok: d.ok })),
    },
  });
}
