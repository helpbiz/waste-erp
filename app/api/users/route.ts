/**
 * GET  /api/users — 가시범위 사용자 목록 (검색·필터)
 * POST /api/users — 신규 사용자 등록 (관리자만)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSession, hashPassword } from '@/lib/auth';
import { userScope, canManageUsers } from '@/lib/users';
import { findPositionByCode } from '@/lib/positions';
import { createMediaAsset, validateDataUrl } from '@/lib/media-assets';
import { registerUserSignature } from '@/lib/signatures';
import { recordApproval } from '@/lib/approvals';
import { encryptField, decryptField, maskValue } from '@/lib/crypto';

export const runtime = 'nodejs';

const Create = z.object({
  /* dealer-channel Design §3.1 — 이메일 형태 username(예: dealer@cleanerp.kr) 지원을 위해 @/. 허용 */
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.@-]+$/),
  password: z.string().min(6).max(100),
  name: z.string().trim().min(1).max(50),
  role: z.enum(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER', 'DEALER']),
  contractorId: z.string().optional().nullable(),
  municipalityId: z.string().optional().nullable(),
  /* dealer-channel Design §3.1 확장 — DEALER 전용 표시용 라벨 */
  dealerCompany: z.string().trim().max(100).optional().nullable(),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).optional().nullable(),
  employeeNo: z.string().trim().max(30).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
  birthDate: z.string().optional().nullable(),
  gender: z.string().max(10).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  hireDate: z.string().optional().nullable(),
  emergencyContact: z.string().max(50).optional().nullable(),
  emergencyPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).optional().nullable(),
  bankName: z.string().max(30).optional().nullable(),
  bankAccount: z.string().max(50).optional().nullable(),
  memo: z.string().optional().nullable(),
  /* user-mgmt-extended */
  positionCode: z.string().max(20).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  profilePhoto: z.string().max(700_000).optional().nullable(),    // data URL ≤ ~500KB
  signature: z.string().max(280_000).optional().nullable(),       // data URL ≤ ~200KB
  consentPII: z.boolean().optional(),
  /* AVAC 보강 (Hot-fix 2026-05-02) — 직급·주근무지 */
  rank: z.enum([
    'ENGINEER_MASTER','ENGINEER_SENIOR','ENGINEER_HIGH','ENGINEER_MID','ENGINEER_BEGINNER',
    'SKILL_HIGH','SKILL_MID','SKILL_BEGINNER','LABORER',
  ]).optional().nullable(),
  primaryFacilityId: z.string().optional().nullable(),  // BigInt as string
});

const normPhone = (p?: string | null) => (p ? p.replace(/-/g, '') : null);
const toDate = (s?: string | null) => (s ? new Date(s) : null);

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');

  const where: Prisma.UserWhereInput = { ...userScope(session) };
  if (role) where.role = role as Prisma.UserWhereInput['role'];
  if (status) where.status = status as Prisma.UserWhereInput['status'];
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { employeeNo: { contains: q, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.user.findMany({
    where,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 200,
    select: {
      id: true, username: true, name: true, role: true, status: true,
      contractorId: true, municipalityId: true, phone: true, employeeNo: true,
      birthDate: true, hireDate: true, lastLogin: true, createdAt: true,
      isFacilityOperator: true,
      dealerCompany: true,
      primaryFacility: { select: { id: true, name: true, type: true } },
    },
  });

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      contractorId: u.contractorId?.toString() ?? null,
      municipalityId: u.municipalityId?.toString() ?? null,
      phone: u.phone,
      employeeNo: u.employeeNo,
      dealerCompany: u.dealerCompany,
      birthDate: u.birthDate?.toISOString().slice(0, 10) ?? null,
      hireDate: u.hireDate?.toISOString().slice(0, 10) ?? null,
      lastLogin: u.lastLogin?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      isFacilityOperator: u.isFacilityOperator,
      primaryFacility: u.primaryFacility
        ? { id: u.primaryFacility.id.toString(), name: u.primaryFacility.name, type: u.primaryFacility.type }
        : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  /* contractorId 강제 — 비-SUPER_ADMIN은 본인 위탁업체에만 등록 가능 */
  let contractorId: bigint | null = b.contractorId ? BigInt(b.contractorId) : null;
  if (session.role !== 'SUPER_ADMIN') {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
    contractorId = BigInt(session.contractorId);
  }

  /* SUPER_ADMIN 등록은 SUPER_ADMIN만 */
  if (b.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
  }
  /* dealer-channel Design §3.1 — DEALER 등록도 SUPER_ADMIN만(셀프가입 없음, 기존 원칙 그대로). 조직 소속 X */
  if (b.role === 'DEALER') {
    if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
    contractorId = null;
  }
  /* MUNI_ADMIN — 위탁업체 admin도 본인 위탁업체의 지자체 산하로 등록 가능 */
  let municipalityIdForMuni: bigint | null = null;
  if (b.role === 'MUNI_ADMIN') {
    if (b.municipalityId) {
      municipalityIdForMuni = BigInt(b.municipalityId);
    } else if (session.contractorId) {
      const c = await prisma.contractor.findUnique({
        where: { id: BigInt(session.contractorId) },
        select: { municipalityId: true },
      });
      municipalityIdForMuni = c?.municipalityId ?? null;
    }
    if (!municipalityIdForMuni) return NextResponse.json({ error: 'municipality_required' }, { status: 400 });
    /* MUNI_ADMIN은 contractor 소속 X */
    contractorId = null;
  }

  const dup = await prisma.user.findUnique({ where: { username: b.username } });
  if (dup) return NextResponse.json({ error: 'username_taken' }, { status: 409 });

  /* Position 코드 → ID 변환 */
  let positionId: bigint | null = null;
  if (b.positionCode) {
    const p = await findPositionByCode(b.positionCode);
    if (!p) return NextResponse.json({ error: 'invalid_position_code' }, { status: 400 });
    positionId = p.id;
  }

  /* Department 검증 */
  let departmentId: bigint | null = null;
  if (b.departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: BigInt(b.departmentId), contractorId: contractorId ?? undefined },
      select: { id: true },
    });
    if (!d) return NextResponse.json({ error: 'invalid_department' }, { status: 400 });
    departmentId = d.id;
  }

  /* 사진 검증 (PII 동의 필수) */
  if (b.profilePhoto) {
    const v = validateDataUrl(b.profilePhoto, 'photo');
    if ('error' in v) return NextResponse.json({ error: 'photo_' + v.error }, { status: 400 });
    if (b.consentPII !== true) return NextResponse.json({ error: 'pii_consent_required' }, { status: 400 });
  }
  if (b.signature) {
    const v = validateDataUrl(b.signature, 'signature');
    if ('error' in v) return NextResponse.json({ error: 'signature_' + v.error }, { status: 400 });
  }

  const passwordHash = await hashPassword(b.password);

  const created = await prisma.user.create({
    data: {
      username: b.username,
      passwordHash,
      name: b.name,
      role: b.role,
      contractorId,
      municipalityId: b.role === 'DEALER' ? null : (municipalityIdForMuni ?? (b.municipalityId ? BigInt(b.municipalityId) : null)),
      phone: normPhone(b.phone),
      employeeNo: b.employeeNo ?? null,
      status: b.status ?? 'ACTIVE',
      birthDate: toDate(b.birthDate),
      gender: b.gender ?? null,
      /* PII 암호화 */
      address: await encryptField(b.address ?? null),
      hireDate: toDate(b.hireDate),
      emergencyContact: await encryptField(b.emergencyContact ?? null),
      emergencyPhone: await encryptField(normPhone(b.emergencyPhone)),
      bankName: b.bankName ?? null,
      bankAccount: await encryptField(b.bankAccount ?? null),
      memo: b.memo ?? null,
      positionId,
      departmentId,
      rank: b.rank ?? null,
      primaryFacilityId: b.primaryFacilityId ? BigInt(b.primaryFacilityId) : null,
      dealerCompany: b.role === 'DEALER' ? (b.dealerCompany ?? null) : null,
    },
  });

  /* 사진 등록 — User 생성 후 ownerId 채우기 */
  if (b.profilePhoto) {
    const asset = await createMediaAsset({
      ownerType: 'user_photo',
      ownerId: created.id,
      dataUrl: b.profilePhoto,
      kind: 'photo',
      createdBy: BigInt(session.userId),
    });
    if (!('error' in asset)) {
      await prisma.user.update({ where: { id: created.id }, data: { profilePhotoId: asset.id } });
    }
  }
  /* 서명 등록 */
  if (b.signature) {
    await registerUserSignature({
      userId: created.id,
      dataUrl: b.signature,
      createdBy: BigInt(session.userId),
    });
  }

  /* ApprovalEvent (Plan FR-08) */
  await recordApproval({
    actorId: BigInt(session.userId),
    resourceType: 'user_create',
    resourceId: created.id.toString(),
    action: 'CREATE',
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'USER_CREATE',
      resourceType: 'user',
      resourceId: created.id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        role: b.role,
        contractorId: contractorId?.toString() ?? null,
        positionCode: b.positionCode ?? null,
        departmentId: departmentId?.toString() ?? null,
        profilePhotoChanged: !!b.profilePhoto,
        signatureChanged: !!b.signature,
        consentPII: b.consentPII ?? false,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, id: created.id.toString() }, { status: 201 });
}
