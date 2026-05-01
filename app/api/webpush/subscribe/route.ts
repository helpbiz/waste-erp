/**
 * WebPush 구독 — 클라이언트가 PushSubscription 을 서버에 등록.
 * VAPID public key 미설정이어도 endpoint 만 받아 저장 (실제 발송은 별도 cron/server 에서).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

const Body = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const b = parsed.data;
  const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  /* upsert by endpoint — 동일 디바이스 재구독 시 갱신 */
  await prisma.webPushSubscription.upsert({
    where: { endpoint: b.endpoint },
    create: {
      userId: BigInt(session.userId),
      endpoint: b.endpoint,
      p256dh: b.keys.p256dh,
      auth: b.keys.auth,
      userAgent: ua,
    },
    update: {
      userId: BigInt(session.userId),  /* 디바이스를 다른 사용자가 사용하는 경우 갱신 */
      p256dh: b.keys.p256dh,
      auth: b.keys.auth,
      userAgent: ua,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'endpoint_required' }, { status: 400 });

  await prisma.webPushSubscription.deleteMany({
    where: { endpoint, userId: BigInt(session.userId) },
  });
  return NextResponse.json({ ok: true });
}
