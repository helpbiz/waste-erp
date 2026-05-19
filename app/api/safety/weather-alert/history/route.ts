/**
 * GET /api/safety/weather-alert/history — 기상안전 공지 발송이력 (관리자 전용)
 * Query: limit=30, offset=0
 *
 * Note: AuditLog 모델에 actor relation이 없으므로 actorId로 별도 User 조회
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 30)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  const where = {
    action: 'WEATHER_ALERT_DISPATCH',
    ...(session.contractorId ? { resourceId: session.contractorId.toString() } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // actorId로 User 이름 일괄 조회 (AuditLog에 actor relation 없음)
  const actorIds = [...new Set(logs.map((l) => l.actorId).filter((id): id is bigint => id !== null))];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    for (const u of users) {
      actorMap.set(u.id.toString(), u.name);
    }
  }

  return NextResponse.json({
    total,
    items: logs.map((l) => ({
      id: l.id.toString(),
      actorName: l.actorId ? (actorMap.get(l.actorId.toString()) ?? '시스템') : '시스템',
      createdAt: l.createdAt.toISOString(),
      metadata: l.metadata as {
        type?: string; typeLabel?: string;
        recipientCount?: number; provider?: string;
        sent?: number; failed?: number; messageLen?: number;
      } | null,
    })),
  });
}
