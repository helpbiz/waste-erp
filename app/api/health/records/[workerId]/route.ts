/**
 * PATCH /api/health/records/[workerId] — 건강기록 upsert
 *  - 권한: CONTRACTOR_ADMIN, INTERNAL_ADMIN, SUPER_ADMIN
 *  - 워커는 본인 위탁업체 소속이어야 함
 *  - 모든 변경은 audit_log에 metadata 기록 (의료 정보 접근 추적)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { encryptHealthRecordInput, type HealthRecordWriteInput } from '@/lib/health';

export const runtime = 'nodejs';

function isHealthManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

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

export async function PATCH(req: Request, { params }: { params: { workerId: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isHealthManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const workerId = BigInt(params.workerId);
  const worker = await prisma.user.findUnique({ where: { id: workerId } });
  if (!worker || worker.role !== 'WORKER') return NextResponse.json({ error: 'not_found' }, { status: 404 });

  /* 본인 위탁업체 소속만 */
  if (session.role !== 'SUPER_ADMIN' && worker.contractorId?.toString() !== session.contractorId) {
    return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  /* AES-256-GCM 암호화 — 평문 입력을 'v1:iv:tag:ct'로 변환 (KMS 키 사용) */
  const encrypted = await encryptHealthRecordInput(b as HealthRecordWriteInput);

  const upserted = await prisma.healthRecord.upsert({
    where: { workerId },
    update: { ...encrypted, updatedBy: BigInt(session.userId) },
    create: {
      workerId,
      contractorId: worker.contractorId!,
      ...encrypted,
      updatedBy: BigInt(session.userId),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'HEALTH_RECORD_UPSERT',
      resourceType: 'health_record',
      resourceId: upserted.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { workerId: workerId.toString(), changedKeys: Object.keys(b) } as object,
    },
  });

  return NextResponse.json({ ok: true, recordId: upserted.id.toString() });
}
