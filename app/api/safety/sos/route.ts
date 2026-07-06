/**
 * POST /api/safety/sos — 워커 긴급 SOS (Plan §3-4 119 자동 문자)
 *
 * 시안 단계 stub:
 *  - SafetyReport (INCIDENT, severity=SEVERE) 자동 생성 + molDeadline=24h
 *  - audit_log 'EMERGENCY_SOS' + 'EMERGENCY_SMS_DISPATCH' 기록 (수신자 stub)
 *  - 응답에 시뮬레이션 알림 메시지 + 보고서 ID
 *
 * 운영 단계: 통신사 API 계약 후 실제 SMS 발송 + Slack/이메일 fanout
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { todayKstDate } from '@/lib/dates';
import { computeMolDeadline } from '@/lib/safety';
import { getSmsProvider, type SmsRecipient } from '@/lib/sms';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const Body = z.object({
  description: z.string().trim().max(1000).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  locationAddress: z.string().trim().max(255).optional(),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'workers_only' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const b = parsed.data;
  if (b.locationLat != null && b.locationLng != null && !isInsideKorea(b.locationLat, b.locationLng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  const now = new Date();
  const contractorId = BigInt(session.contractorId);
  const reporterId = BigInt(session.userId);

  /* SafetyReport (INCIDENT, SEVERE) 자동 생성 */
  const report = await prisma.safetyReport.create({
    data: {
      contractorId,
      reportedBy: reporterId,
      reportType: 'INCIDENT',
      severity: 'SEVERE',
      reportDate: todayKstDate(),
      occurredAt: now,
      molDeadline: computeMolDeadline('SEVERE', now),
      description: '🚨 긴급 SOS 발신 — ' + (b.description ?? '근로자 긴급 호출 (현장 위급 상황)'),
      locationLat: roundCoord(b.locationLat),
      locationLng: roundCoord(b.locationLng),
      locationAddress: b.locationAddress ?? null,
      status: 'SUBMITTED',
    },
  });

  /* 수신자 결정 — 위탁업체 매니저 + 119 */
  const reporter = await prisma.user.findUnique({
    where: { id: reporterId },
    select: { name: true, phone: true },
  });
  const managers = await prisma.user.findMany({
    where: {
      contractorId,
      role: { in: ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] },
      status: 'ACTIVE',
    },
    select: { id: true, name: true, phone: true },
  });
  const recipients: SmsRecipient[] = [
    { type: '119', name: '소방·구급', phone: '119' },
    ...managers.map((m) => ({ type: 'MANAGER' as const, name: m.name, phone: m.phone ?? null })),
  ];

  /* SMS 발송 (provider 추상화 — 환경변수로 SIMULATION/SOLAPI 전환) */
  const provider = getSmsProvider({ isDemo: session.isDemo === true });
  const locText =
    b.locationAddress
      ? `\n위치: ${b.locationAddress}`
      : b.locationLat != null && b.locationLng != null
      ? `\n위치: ${b.locationLat.toFixed(5)}°N ${b.locationLng.toFixed(5)}°E`
      : '';
  const message =
    `[CleanERP 긴급 SOS] ${reporter?.name ?? '근로자'} (위탁업체 #${contractorId})${locText}` +
    `\n사고보고 ID: ${report.id}` +
    (b.description ? `\n${b.description.slice(0, 80)}` : '');

  let smsResult;
  try {
    smsResult = await provider.send(recipients, message);
  } catch (e) {
    smsResult = {
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

  /* audit_log: SOS + SMS 발송 결과 */
  await writeAudit(req, session, {
    action: 'EMERGENCY_SOS',
    resourceType: 'safety_report',
    resourceId: report.id.toString(),
    metadata: {
      reportId: report.id.toString(),
      recipientCount: recipients.length,
      lat: roundCoord(b.locationLat),
      lng: roundCoord(b.locationLng),
    },
  });
  await writeAudit(req, session, {
    action: 'EMERGENCY_SMS_DISPATCH',
    resourceType: 'safety_report',
    resourceId: report.id.toString(),
    metadata: {
      provider: smsResult.provider,
      sent: smsResult.sent,
      failed: smsResult.failed,
      recipients: smsResult.details.map((d) => ({ type: d.recipientType, name: d.recipientName, ok: d.ok })),
    },
  });

  return NextResponse.json({
    ok: true,
    reportId: report.id.toString(),
    severity: 'SEVERE',
    molDeadline: report.molDeadline?.toISOString() ?? null,
    notification: {
      provider: smsResult.provider,
      simulated: smsResult.provider === 'SIMULATION',
      recipientsNotified: smsResult.sent,
      failed: smsResult.failed,
      recipients: smsResult.details.map((d) => ({ type: d.recipientType, name: d.recipientName, ok: d.ok })),
      message:
        smsResult.provider === 'SIMULATION'
          ? `긴급 SOS가 ${smsResult.sent}곳에 시뮬레이션 발송되었습니다 (SMS_PROVIDER=solapi 설정 + Solapi 키로 실 발송 전환).`
          : `긴급 SOS가 ${smsResult.sent}곳에 실제 SMS 발송되었습니다.`,
    },
  });
}
