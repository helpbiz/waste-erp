/**
 * GET    /api/users/[id] — 사용자 상세 (인적사항 포함)
 * PATCH  /api/users/[id] — 인적사항/상태/비밀번호 수정
 * DELETE /api/users/[id] — 비활성화 (soft delete: status=INACTIVE)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession, hashPassword } from '@/lib/auth';
import { userScope, canManageUsers, recommendedAnnualLeaveDays } from '@/lib/users';
import { findPositionByCode, listActivePositions } from '@/lib/positions';
import { createMediaAsset, validateDataUrl, readDataUrl } from '@/lib/media-assets';
import { registerUserSignature } from '@/lib/signatures';
import { encryptField, decryptField, maskValue } from '@/lib/crypto';

export const runtime = 'nodejs';

const Patch = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  password: z.string().min(6).max(100).optional(),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).nullable().optional(),
  employeeNo: z.string().trim().max(30).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.string().max(10).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  hireDate: z.string().nullable().optional(),
  resignDate: z.string().nullable().optional(),
  emergencyContact: z.string().max(50).nullable().optional(),
  emergencyPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).nullable().optional(),
  bankName: z.string().max(30).nullable().optional(),
  bankAccount: z.string().max(50).nullable().optional(),
  memo: z.string().nullable().optional(),
  /* user-mgmt-extended */
  positionCode: z.string().max(20).nullable().optional(),
  departmentId: z.string().nullable().optional(),
  profilePhoto: z.string().max(700_000).nullable().optional(),
  signature: z.string().max(280_000).nullable().optional(),
  consentPII: z.boolean().optional(),
  /* AVAC 보강 (Hot-fix 2026-05-02) — 직급·주근무지 */
  rank: z.enum([
    'ENGINEER_MASTER','ENGINEER_SENIOR','ENGINEER_HIGH','ENGINEER_MID','ENGINEER_BEGINNER',
    'SKILL_HIGH','SKILL_MID','SKILL_BEGINNER','LABORER',
  ]).nullable().optional(),
  primaryFacilityId: z.string().nullable().optional(),
  /* contractor-org-master — Design Ref: §4.6 */
  contractorPositionId: z.string().nullable().optional(),
  rankId: z.string().nullable().optional(),
});

const normPhone = (p?: string | null) => (p == null ? p : p.replace(/-/g, ''));
const toDate = (s?: string | null) => (s == null ? s : s ? new Date(s) : null);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(params.id);
  const u = await prisma.user.findFirst({
    where: { id, ...userScope(session) },
    include: {
      contractor: { select: { id: true, companyName: true } },
      leaveBalances: { orderBy: { year: 'desc' }, take: 5 },
      position: true,
      department: true,
      profilePhoto: { select: { id: true, contentRef: true, mimeType: true, sizeBytes: true } },
      activeSignature: { include: { asset: { select: { contentRef: true, sizeBytes: true } } } },
      primaryFacility: { select: { id: true, name: true, type: true } },
    },
  });
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const recommend = recommendedAnnualLeaveDays(u.hireDate);
  /* PII 복호화 */
  const [addressPlain, bankAccountPlain] = await Promise.all([
    decryptField(u.address),
    decryptField(u.bankAccount),
  ]);
  return NextResponse.json({
    user: {
      id: u.id.toString(),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      contractorId: u.contractorId?.toString() ?? null,
      contractorName: u.contractor?.companyName ?? null,
      phone: u.phone,
      employeeNo: u.employeeNo,
      birthDate: u.birthDate?.toISOString().slice(0, 10) ?? null,
      gender: u.gender,
      address: addressPlain,
      hireDate: u.hireDate?.toISOString().slice(0, 10) ?? null,
      resignDate: u.resignDate?.toISOString().slice(0, 10) ?? null,
      emergencyContact: u.emergencyContact,
      emergencyPhone: u.emergencyPhone,
      bankName: u.bankName,
      bankAccount: bankAccountPlain,
      bankAccountMasked: maskValue(bankAccountPlain, 4),
      memo: u.memo,
      lastLogin: u.lastLogin?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      position: u.position
        ? { id: u.position.id.toString(), code: u.position.code, label: u.position.label, category: u.position.category }
        : null,
      department: u.department
        ? { id: u.department.id.toString(), name: u.department.name }
        : null,
      /* AVAC 보강 — 직급·주근무지 */
      rank: u.rank,
      primaryFacility: u.primaryFacility
        ? { id: u.primaryFacility.id.toString(), name: u.primaryFacility.name, type: u.primaryFacility.type }
        : null,
      profilePhotoUrl: u.profilePhoto?.contentRef ?? null,
      profilePhotoSize: u.profilePhoto?.sizeBytes ?? null,
      activeSignatureRef: u.activeSignature?.signatureRef ?? null,
      activeSignatureUrl: u.activeSignature?.asset.contentRef ?? null,
    },
    recommend,
    leaveBalances: u.leaveBalances.map((b) => ({
      id: b.id.toString(),
      year: b.year,
      granted: Number(b.granted.toString()),
      used: Number(b.used.toString()),
      carriedOver: Number(b.carriedOver.toString()),
      note: b.note,
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}

/* 변경 이력 추적 대상 필드 — passwordHash는 값 자체가 아닌 boolean(changed)만 기록 */
const TRACKED_FIELDS = [
  'name', 'phone', 'employeeNo', 'status',
  'birthDate', 'gender', 'address', 'hireDate', 'resignDate',
  'emergencyContact', 'emergencyPhone', 'bankName', 'bankAccount', 'memo',
] as const;

/* PII 필드는 audit에 마스킹 처리 (Plan R5) */
const PII_FIELDS = new Set(['address', 'bankAccount']);

function serializeForAudit(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  const before = await prisma.user.findFirst({
    where: { id, ...userScope(session) },
    select: {
      id: true,
      name: true, phone: true, employeeNo: true, status: true,
      birthDate: true, gender: true, address: true, hireDate: true, resignDate: true,
      emergencyContact: true, emergencyPhone: true, bankName: true, bankAccount: true, memo: true,
    },
  });
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  /* PII 평문 보관용 (audit 비교 + 검증 후 암호화 저장) */
  const piiPlain: { address?: string | null; bankAccount?: string | null } = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.password) data.passwordHash = await hashPassword(b.password);
  if (b.phone !== undefined) data.phone = normPhone(b.phone);
  if (b.employeeNo !== undefined) data.employeeNo = b.employeeNo;
  if (b.status !== undefined) data.status = b.status;
  if (b.birthDate !== undefined) data.birthDate = toDate(b.birthDate);
  if (b.gender !== undefined) data.gender = b.gender;
  if (b.address !== undefined) {
    piiPlain.address = b.address;
    data.address = await encryptField(b.address);
  }
  if (b.hireDate !== undefined) data.hireDate = toDate(b.hireDate);
  if (b.resignDate !== undefined) data.resignDate = toDate(b.resignDate);
  if (b.emergencyContact !== undefined) data.emergencyContact = b.emergencyContact;
  if (b.emergencyPhone !== undefined) data.emergencyPhone = normPhone(b.emergencyPhone);
  if (b.bankName !== undefined) data.bankName = b.bankName;
  if (b.bankAccount !== undefined) {
    piiPlain.bankAccount = b.bankAccount;
    data.bankAccount = await encryptField(b.bankAccount);
  }
  if (b.memo !== undefined) data.memo = b.memo;

  /* Position 코드 → ID */
  if (b.positionCode !== undefined) {
    if (b.positionCode === null) data.positionId = null;
    else {
      const p = await findPositionByCode(b.positionCode);
      if (!p) return NextResponse.json({ error: 'invalid_position_code' }, { status: 400 });
      data.positionId = p.id;
    }
  }
  /* Department */
  if (b.departmentId !== undefined) {
    if (b.departmentId === null) data.departmentId = null;
    else {
      const d = await prisma.department.findFirst({
        where: { id: BigInt(b.departmentId) },
        select: { id: true, contractorId: true },
      });
      if (!d) return NextResponse.json({ error: 'invalid_department' }, { status: 400 });
      data.departmentId = d.id;
    }
  }

  /* AVAC 보강 — 직급 */
  if (b.rank !== undefined) data.rank = b.rank;

  /* contractor-org-master — 업체별 직책·직급 */
  if (b.contractorPositionId !== undefined) {
    data.contractorPositionId = b.contractorPositionId === null ? null : BigInt(b.contractorPositionId);
  }
  if (b.rankId !== undefined) {
    data.rankId = b.rankId === null ? null : BigInt(b.rankId);
  }

  /* AVAC 보강 — 주근무지 (시설) */
  if (b.primaryFacilityId !== undefined) {
    if (b.primaryFacilityId === null) data.primaryFacilityId = null;
    else {
      const f = await prisma.wasteTreatmentFacility.findFirst({
        where: { id: BigInt(b.primaryFacilityId) },
        select: { id: true, municipalityId: true, active: true },
      });
      if (!f || !f.active) return NextResponse.json({ error: 'invalid_facility' }, { status: 400 });
      data.primaryFacilityId = f.id;
    }
  }

  /* 실제로 값이 바뀐 필드만 추적 — PII는 평문 비교 + 마스킹 저장 */
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of TRACKED_FIELDS) {
    if (!(f in data)) continue;
    const beforeRaw = (before as Record<string, unknown>)[f];
    let fromPlain: unknown;
    let toPlain: unknown;
    if (PII_FIELDS.has(f)) {
      /* before는 암호문일 수 있음 → decrypt */
      fromPlain = typeof beforeRaw === 'string' ? await decryptField(beforeRaw) : beforeRaw;
      toPlain = (piiPlain as Record<string, unknown>)[f];
    } else {
      fromPlain = beforeRaw;
      toPlain = data[f];
    }
    const fromVal = serializeForAudit(fromPlain);
    const toVal = serializeForAudit(toPlain);
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      changes[f] = PII_FIELDS.has(f)
        ? { from: maskValue(fromVal as string | number | null, 4), to: maskValue(toVal as string | number | null, 4) }
        : { from: fromVal, to: toVal };
    }
  }
  const passwordChanged = !!data.passwordHash;

  /* 사진/서명 변경 처리 (data엔 안 담기, 별도 로직) */
  let profilePhotoChanged = false;
  let signatureChanged = false;

  if (b.profilePhoto !== undefined) {
    if (b.profilePhoto === null) {
      data.profilePhotoId = null;
      profilePhotoChanged = true;
    } else {
      const v = validateDataUrl(b.profilePhoto, 'photo');
      if ('error' in v) return NextResponse.json({ error: 'photo_' + v.error }, { status: 400 });
      if (b.consentPII !== true) return NextResponse.json({ error: 'pii_consent_required' }, { status: 400 });
      const asset = await createMediaAsset({
        ownerType: 'user_photo',
        ownerId: id,
        dataUrl: b.profilePhoto,
        kind: 'photo',
        createdBy: BigInt(session.userId),
      });
      if ('error' in asset) return NextResponse.json({ error: 'photo_' + asset.error }, { status: 400 });
      data.profilePhotoId = asset.id;
      profilePhotoChanged = true;
    }
  }
  if (b.signature !== undefined && b.signature !== null) {
    const v = validateDataUrl(b.signature, 'signature');
    if ('error' in v) return NextResponse.json({ error: 'signature_' + v.error }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });

  /* 서명은 User update 후 별도 register (active 갱신 트랜잭션) */
  if (b.signature) {
    const reg = await registerUserSignature({
      userId: id,
      dataUrl: b.signature,
      createdBy: BigInt(session.userId),
    });
    if (!('error' in reg)) signatureChanged = true;
  } else if (b.signature === null) {
    /* 서명 제거 — active 비활성화 */
    await prisma.signature.updateMany({ where: { userId: id, deactivatedAt: null }, data: { deactivatedAt: new Date() } });
    await prisma.user.update({ where: { id }, data: { activeSignatureId: null } });
    signatureChanged = true;
  }

  /* 변경된 게 없으면 audit 미기록 */
  if (Object.keys(changes).length > 0 || passwordChanged || profilePhotoChanged || signatureChanged) {
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'USER_UPDATE',
        resourceType: 'user',
        resourceId: id.toString(),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        metadata: { changes, passwordChanged, profilePhotoChanged, signatureChanged } as object,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    changedFields: Object.keys(changes),
    passwordChanged,
    profilePhotoChanged,
    signatureChanged,
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = BigInt(params.id);
  if (id.toString() === session.userId) {
    return NextResponse.json({ error: 'cannot_disable_self' }, { status: 409 });
  }
  const target = await prisma.user.findFirst({ where: { id, ...userScope(session) }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'USER_DISABLE',
      resourceType: 'user',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {} as object,
    },
  });
  return NextResponse.json({ ok: true });
}
