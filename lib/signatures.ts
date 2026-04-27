/**
 * Signature — 서명 등록 + 활성화 관리
 * Design Ref: §2.1 D3, R5(동일 sha256 재활성화)
 */
import { prisma } from './db';
import { createMediaAsset, parseDataUrl, validateDataUrl } from './media-assets';

/** sha256(base64).slice(0, 16) — 외부 audit 참조용 */
export function computeSignatureRef(dataUrl: string): string | null {
  const info = parseDataUrl(dataUrl);
  if ('error' in info) return null;
  return info.sha256.slice(0, 16);
}

/**
 * 서명 등록 + User.activeSignatureId 갱신
 * 동일 sha256 존재 시 재활성화(activatedAt 갱신)하여 row 폭증 방지.
 */
export async function registerUserSignature(params: {
  userId: bigint;
  dataUrl: string;
  createdBy: bigint;
}): Promise<{ id: bigint; signatureRef: string } | { error: string }> {
  const valid = validateDataUrl(params.dataUrl, 'signature');
  if ('error' in valid) return { error: valid.error };
  const ref = valid.sha256.slice(0, 16);

  /* 이미 같은 sha256 서명이 등록돼 있으면 재활성화 */
  const existing = await prisma.signature.findFirst({
    where: { userId: params.userId, signatureRef: ref },
    orderBy: { id: 'desc' },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.signature.updateMany({
        where: { userId: params.userId, deactivatedAt: null, NOT: { id: existing.id } },
        data: { deactivatedAt: new Date() },
      }),
      prisma.signature.update({
        where: { id: existing.id },
        data: { activatedAt: new Date(), deactivatedAt: null },
      }),
      prisma.user.update({
        where: { id: params.userId },
        data: { activeSignatureId: existing.id },
      }),
    ]);
    return { id: existing.id, signatureRef: ref };
  }

  /* 신규: MediaAsset → Signature 생성, 기존 활성 비활성화 */
  const asset = await createMediaAsset({
    ownerType: 'user_signature',
    ownerId: params.userId,
    dataUrl: params.dataUrl,
    kind: 'signature',
    createdBy: params.createdBy,
  });
  if ('error' in asset) return { error: asset.error };

  const created = await prisma.$transaction(async (tx) => {
    await tx.signature.updateMany({
      where: { userId: params.userId, deactivatedAt: null },
      data: { deactivatedAt: new Date() },
    });
    const sig = await tx.signature.create({
      data: {
        userId: params.userId,
        assetId: asset.id,
        signatureRef: ref,
        createdBy: params.createdBy,
      },
    });
    await tx.user.update({
      where: { id: params.userId },
      data: { activeSignatureId: sig.id },
    });
    return sig;
  });

  return { id: created.id, signatureRef: ref };
}

/** 결재 시점 사용 — 즉석 신규 서명 또는 저장된 서명 반환 */
export async function resolveApprovalSignature(params: {
  actorId: bigint;
  dataUrl?: string | null;
  useStoredSignature?: boolean;
}): Promise<{ signatureId: bigint; signatureRef: string; dataUrl: string } | { error: string }> {
  if (params.useStoredSignature || !params.dataUrl) {
    /* 저장된 active 서명 사용 */
    const user = await prisma.user.findUnique({
      where: { id: params.actorId },
      select: { activeSignatureId: true },
    });
    if (!user?.activeSignatureId) return { error: 'no_stored_signature' };
    const sig = await prisma.signature.findUnique({
      where: { id: user.activeSignatureId },
      include: { asset: true },
    });
    if (!sig) return { error: 'signature_missing' };
    return { signatureId: sig.id, signatureRef: sig.signatureRef, dataUrl: sig.asset.contentRef };
  }

  /* 즉석 서명 — 등록 + 사용 */
  const reg = await registerUserSignature({
    userId: params.actorId,
    dataUrl: params.dataUrl,
    createdBy: params.actorId,
  });
  if ('error' in reg) return reg;
  return { signatureId: reg.id, signatureRef: reg.signatureRef, dataUrl: params.dataUrl };
}
