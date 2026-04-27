/**
 * GET   /api/worker/profile  — 본인 인적사항 + 사진/서명
 * PATCH /api/worker/profile  — 본인 사진/서명/연락처 갱신 (제한된 필드)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { encryptField, decryptField } from '@/lib/crypto';
import { createMediaAsset, validateDataUrl } from '@/lib/media-assets';
import { registerUserSignature } from '@/lib/signatures';

export const runtime = 'nodejs';

const Patch = z.object({
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).nullable().optional(),
  emergencyContact: z.string().max(50).nullable().optional(),
  emergencyPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  bankName: z.string().max(30).nullable().optional(),
  bankAccount: z.string().max(50).nullable().optional(),
  profilePhoto: z.string().max(700_000).nullable().optional(),
  signature: z.string().max(280_000).nullable().optional(),
  consentPII: z.boolean().optional(),
});

const normPhone = (p?: string | null) => (p == null ? p : p.replace(/-/g, ''));

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(session.userId);
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      position: true,
      department: true,
      profilePhoto: { select: { contentRef: true } },
      activeSignature: { select: { signatureRef: true, asset: { select: { contentRef: true } } } },
    },
  });
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [address, bankAccount] = await Promise.all([decryptField(u.address), decryptField(u.bankAccount)]);

  return NextResponse.json({
    user: {
      id: u.id.toString(),
      name: u.name,
      role: u.role,
      employeeNo: u.employeeNo,
      phone: u.phone,
      birthDate: u.birthDate?.toISOString().slice(0, 10) ?? null,
      hireDate: u.hireDate?.toISOString().slice(0, 10) ?? null,
      address,
      emergencyContact: u.emergencyContact,
      emergencyPhone: u.emergencyPhone,
      bankName: u.bankName,
      bankAccount,
      position: u.position ? { code: u.position.code, label: u.position.label, category: u.position.category } : null,
      department: u.department ? { name: u.department.name } : null,
      profilePhotoUrl: u.profilePhoto?.contentRef ?? null,
      activeSignatureRef: u.activeSignature?.signatureRef ?? null,
      activeSignatureUrl: u.activeSignature?.asset.contentRef ?? null,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = BigInt(session.userId);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  if (b.phone !== undefined) data.phone = normPhone(b.phone);
  if (b.emergencyContact !== undefined) data.emergencyContact = b.emergencyContact;
  if (b.emergencyPhone !== undefined) data.emergencyPhone = normPhone(b.emergencyPhone);
  if (b.address !== undefined) data.address = await encryptField(b.address);
  if (b.bankName !== undefined) data.bankName = b.bankName;
  if (b.bankAccount !== undefined) data.bankAccount = await encryptField(b.bankAccount);

  /* 사진 */
  let profilePhotoChanged = false;
  if (b.profilePhoto !== undefined) {
    if (b.profilePhoto === null) {
      data.profilePhotoId = null;
      profilePhotoChanged = true;
    } else {
      const v = validateDataUrl(b.profilePhoto, 'photo');
      if ('error' in v) return NextResponse.json({ error: 'photo_' + v.error }, { status: 400 });
      if (b.consentPII !== true) return NextResponse.json({ error: 'pii_consent_required' }, { status: 400 });
      const asset = await createMediaAsset({
        ownerType: 'user_photo', ownerId: id, dataUrl: b.profilePhoto, kind: 'photo', createdBy: id,
      });
      if ('error' in asset) return NextResponse.json({ error: 'photo_' + asset.error }, { status: 400 });
      data.profilePhotoId = asset.id;
      profilePhotoChanged = true;
    }
  }

  await prisma.user.update({ where: { id }, data });

  let signatureChanged = false;
  if (b.signature) {
    /* 서명 잠금 — 본인이 이미 등록한 서명이 있으면 본인 화면에서 재등록 차단
     * (관리자 화면 /api/users/:id/signature는 별도이며 권한 검사 후 갱신 가능) */
    const meWithSig = await prisma.user.findUnique({
      where: { id },
      select: { activeSignatureId: true },
    });
    if (meWithSig?.activeSignatureId) {
      return NextResponse.json(
        { error: 'signature_locked', message: '이미 서명이 등록되어 있습니다. 변경이 필요하면 관리자에게 문의하세요.' },
        { status: 409 },
      );
    }
    const reg = await registerUserSignature({ userId: id, dataUrl: b.signature, createdBy: id });
    if (!('error' in reg)) signatureChanged = true;
    else return NextResponse.json({ error: 'signature_' + reg.error }, { status: 400 });
  } else if (b.signature === null) {
    /* 본인의 서명 삭제도 차단 — 관리자만 가능 */
    return NextResponse.json(
      { error: 'signature_locked', message: '서명 삭제는 관리자만 수행할 수 있습니다.' },
      { status: 409 },
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: id,
      actorRole: session.role,
      action: 'USER_SELF_UPDATE',
      resourceType: 'user',
      resourceId: id.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: {
        changedFields: Object.keys(data),
        profilePhotoChanged,
        signatureChanged,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, profilePhotoChanged, signatureChanged });
}
