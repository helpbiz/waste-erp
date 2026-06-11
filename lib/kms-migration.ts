/**
 * KMS 마이그레이션 헬퍼 — 다중 키 폴백 복호화
 *
 * 배경: 서로 다른 배포 단계에서 .env / .env.prod 혼용으로 DB에 3개 키로 암호화된
 * 레코드가 혼재하게 됨. 현재 컨테이너가 보유한 단일 키로는 8개 행이 복호화 불가.
 *
 * 사용 목적:
 *   1. scripts/kms-backfill.mjs — 영향 행을 현재 키로 재암호화
 *   2. (임시) API 레이어에서 복호화 실패 시 폴백 시도 (완전 마이그레이션 전)
 *
 * 환경변수:
 *   KMS_LOCAL_KEY       현재 활성 키 (getMasterKey() 사용)
 *   KMS_LOCAL_KEY_PREV1 이전 PROD 키 (docker-compose.yml에 임시 추가)
 *   KMS_LOCAL_KEY_PREV2 PROD_OLD 키 (docker-compose.yml에 임시 추가)
 *
 * ⚠️  백필 완료 후 KMS_LOCAL_KEY_PREV1/PREV2를 환경에서 제거할 것.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getMasterKey } from './kms';

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LEN = 12;

function decryptWithKey(blob: string, key: Buffer): string | null {
  if (!blob.startsWith(VERSION + ':')) return blob; // 평문 레거시
  const parts = blob.split(':');
  if (parts.length !== 4) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ct = Buffer.from(parts[3], 'base64');
    const dec = createDecipheriv(ALGO, key, iv);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
  } catch {
    return undefined as unknown as null; // 이 키로 실패 → 다음 키 시도
  }
}

/** 알려진 모든 키로 복호화 시도. 모두 실패하면 null(복구 불가). */
export async function decryptWithKeyFallback(blob: string | null | undefined): Promise<string | null> {
  if (blob == null || blob === '') return null;
  if (!blob.startsWith(VERSION + ':')) return blob; // 평문

  const keys: Buffer[] = [];

  // 1) 현재 활성 키
  try {
    const { key } = await getMasterKey();
    keys.push(key);
  } catch { /* KMS 미초기화 상태면 건너뜀 */ }

  // 2) 이전 PROD 키
  const prev1 = process.env.KMS_LOCAL_KEY_PREV1;
  if (prev1) {
    const buf = Buffer.from(prev1, 'base64');
    if (buf.length === 32) keys.push(buf);
  }

  // 3) PROD_OLD 키
  const prev2 = process.env.KMS_LOCAL_KEY_PREV2;
  if (prev2) {
    const buf = Buffer.from(prev2, 'base64');
    if (buf.length === 32) keys.push(buf);
  }

  for (const key of keys) {
    const result = decryptWithKey(blob, key);
    // undefined = 이 키로 실패, null = 구조적 문제, string = 성공
    if (result !== (undefined as unknown as null) && result !== null) return result;
    if (result === null && !blob.startsWith(VERSION + ':')) return null;
  }

  return null; // 복구 불가
}

/** 현재 활성 KMS 키로 암호화 (재암호화 백필용) */
export async function reEncryptField(plain: string | null): Promise<string | null> {
  if (plain == null || plain === '') return null;
  const { key } = await getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}
