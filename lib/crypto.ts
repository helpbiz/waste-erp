/**
 * 컬럼 단위 AES-256-GCM 암호화 (KMS 통합)
 *
 * 키 도출: lib/kms.ts → KMS_PROVIDER (local|aws|vault)
 * 첫 호출 시 1회 KMS Decrypt → 메모리 캐시 → 이후 호출 동일 키 재사용
 *
 * 형식: 'v1:iv_b64:tag_b64:ciphertext_b64'
 *  - 버전 prefix로 향후 키 회전·알고리즘 변경 대비
 *  - GCM 모드: 인증된 암호화 (변조 탐지)
 *  - IV는 12바이트 무작위 (NIST 권장)
 *
 * 운영 단계:
 *  - KMS_PROVIDER=aws + AWS_KMS_ENCRYPTED_DEK_BASE64 설정
 *  - 또는 KMS_PROVIDER=vault + VAULT_ADDR/TOKEN/KEY_NAME 설정
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getMasterKey } from './kms';

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LEN = 12;

export async function encryptField(plain: string | null | undefined): Promise<string | null> {
  if (plain == null || plain === '') return null;
  const { key } = await getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export async function decryptField(blob: string | null | undefined): Promise<string | null> {
  if (blob == null || blob === '') return null;
  /* 마이그레이션 호환 — 평문 그대로 저장된 레거시 행 */
  if (!blob.startsWith(VERSION + ':')) return blob;
  const parts = blob.split(':');
  if (parts.length !== 4) return null;
  try {
    const { key } = await getMasterKey();
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ct = Buffer.from(parts[3], 'base64');
    const dec = createDecipheriv(ALGO, key, iv);
    dec.setAuthTag(tag);
    const out = Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
    return out;
  } catch {
    return null; // 복호화 실패 = 위변조 또는 키 불일치
  }
}

export async function encryptNumber(n: number | null | undefined): Promise<string | null> {
  if (n == null) return null;
  return encryptField(String(n));
}

export async function decryptNumber(blob: string | null | undefined): Promise<number | null> {
  const s = await decryptField(blob);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 마스킹 헬퍼 — 다운로드/로그용 (암호화 무관) */
export function maskValue(value: string | number | null, lastN = 4): string {
  if (value == null) return '—';
  const s = String(value);
  if (s.length <= lastN) return '••';
  return '••' + s.slice(-lastN);
}
