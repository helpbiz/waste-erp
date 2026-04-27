/**
 * MediaAsset — data URL 검증/저장
 * Design Ref: §2.1 D4, §7 (사진 500KB / 서명 200KB 제한)
 */
import { createHash } from 'crypto';
import { prisma } from './db';

export type DataUrlInfo = {
  mimeType: string;
  base64: string;
  rawBytes: number;       // base64 디코드 후 실제 바이트 (대략)
  sha256: string;         // sha256(base64) — 동일성 비교용
};

const PHOTO_MIME = /^image\/(png|jpeg|jpg|webp)$/i;
const SIGN_MIME = /^image\/(png|svg\+xml)$/i;

export const PHOTO_MAX_BYTES = 700_000;     // base64 기준 (500KB 원본 ≈ 666KB base64)
export const SIGN_MAX_BYTES = 280_000;      // base64 기준 (200KB 한도)

export type DataUrlKind = 'photo' | 'signature';

export function parseDataUrl(s: string): DataUrlInfo | { error: string } {
  const m = s.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { error: 'invalid_data_url' };
  const mimeType = m[1];
  const base64 = m[2];
  const rawBytes = Math.floor((base64.length * 3) / 4);
  const sha256 = createHash('sha256').update(base64).digest('hex');
  return { mimeType, base64, rawBytes, sha256 };
}

export function validateDataUrl(s: string, kind: DataUrlKind): DataUrlInfo | { error: string } {
  const info = parseDataUrl(s);
  if ('error' in info) return info;
  if (kind === 'photo') {
    if (!PHOTO_MIME.test(info.mimeType)) return { error: 'invalid_mime' };
    if (s.length > PHOTO_MAX_BYTES) return { error: 'too_large' };
  } else {
    if (!SIGN_MIME.test(info.mimeType)) return { error: 'invalid_mime' };
    if (s.length > SIGN_MAX_BYTES) return { error: 'too_large' };
  }
  return info;
}

export type CreateAssetInput = {
  ownerType: 'user_photo' | 'user_signature' | 'leave_signature';
  ownerId: bigint;
  dataUrl: string;
  kind: DataUrlKind;
  createdBy: bigint;
};

export async function createMediaAsset(input: CreateAssetInput): Promise<{ id: bigint; sha256: string; sizeBytes: number } | { error: string }> {
  const valid = validateDataUrl(input.dataUrl, input.kind);
  if ('error' in valid) return { error: valid.error };
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      provider: 'data_url',
      mimeType: valid.mimeType,
      sizeBytes: valid.rawBytes,
      contentRef: input.dataUrl,
      sha256: valid.sha256,
      createdBy: input.createdBy,
    },
  });
  return { id: asset.id, sha256: asset.sha256, sizeBytes: asset.sizeBytes };
}

export async function readDataUrl(assetId: bigint): Promise<string | null> {
  const a = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!a) return null;
  if (a.provider !== 'data_url') return null; // 향후 S3 fetch
  return a.contentRef;
}
