/**
 * GET  /api/health/my-record — 본인 건강기록 조회 (WORKER)
 * PATCH /api/health/my-record — 본인 건강기록 입력/수정 (WORKER)
 *
 * 근로자가 자신의 건강검진 결과를 직접 입력할 수 있도록 허용.
 * 암호화/복호화는 관리자 경로와 동일한 lib/health 사용.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { decryptHealthRecord, encryptHealthRecordInput, type HealthRecordWriteInput } from '@/lib/health';

export const runtime = 'nodejs';

const Body = z.object({
  lastCheckupDate: z.string().nullable().optional(),
  bloodPressureSys: z.number().int().min(50).max(250).nullable().optional(),
  bloodPressureDia: z.number().int().min(30).max(180).nullable().optional(),
  heartRate: z.number().int().min(30).max(220).nullable().optional(),
  bloodSugar: z.number().int().min(40).max(600).nullable().optional(),
  visionLeft: z.number().min(0).max(2.5).nullable().optional(),
  visionRight: z.number().min(0).max(2.5).nullable().optional(),
  hearingLeft: z.string().max(20).nullable().optional(),
  hearingRight: z.string().max(20).nullable().optional(),
  bloodType: z.string().max(8).nullable().optional(),
  allergies: z.string().max(2000).nullable().optional(),
  chronicConditions: z.string().max(2000).nullable().optional(),
  emergencyContact: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const workerId = BigInt(session.userId);
  const record = await prisma.healthRecord.findUnique({ where: { workerId } });
  const plain = await decryptHealthRecord(record);

  return NextResponse.json({ record: plain });
}

export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'WORKER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });

  const workerId = BigInt(session.userId);
  const encrypted = await encryptHealthRecordInput(parsed.data as HealthRecordWriteInput);

  const upserted = await prisma.healthRecord.upsert({
    where: { workerId },
    update: { ...encrypted, updatedBy: workerId },
    create: {
      workerId,
      contractorId: BigInt(session.contractorId),
      ...encrypted,
      updatedBy: workerId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: workerId,
      actorRole: session.role,
      action: 'HEALTH_RECORD_SELF_UPDATE',
      resourceType: 'health_record',
      resourceId: upserted.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { changedKeys: Object.keys(parsed.data) } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
