#!/usr/bin/env node
/**
 * KMS 백필 스크립트 — 다중 키로 암호화된 DB 행을 현재 키로 재암호화
 *
 * 실행 방법:
 *   cd waste-erp
 *   KMS_LOCAL_KEY_PREV1=iJNJvbtfq8XJDvsqK2agnskBPvLUEcGU+aMYVDflq0M= \
 *   KMS_LOCAL_KEY_PREV2=SUlCnxEE8ZXPWA/GfmM9uBz1/BdU7m/rXKWrm8iSLaU= \
 *   node scripts/kms-backfill.mjs
 *
 * 또는 .env 로드:
 *   node -r dotenv/config scripts/kms-backfill.mjs dotenv_config_path=.env
 *
 * 주의: 실행 전 DB 백업 필수. user_id=341 bank_account는 복구 불가(4번째 키) → NULL 처리.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env 파일 로드 (dotenv 없이)
try {
  const envPath = resolve(import.meta.dirname, '../.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env 없으면 환경변수 직접 사용 */ }

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

function decryptWithKey(blob, keyBuf) {
  if (!blob || !blob.startsWith(VERSION + ':')) return blob ?? null;
  const parts = blob.split(':');
  if (parts.length !== 4) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ct = Buffer.from(parts[3], 'base64');
    const dec = createDecipheriv(ALGO, keyBuf, iv);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
  } catch {
    return undefined; // 이 키로 실패
  }
}

function encryptWithKey(plain, keyBuf) {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decryptFallback(blob, keys) {
  if (!blob) return null;
  if (!blob.startsWith(VERSION + ':')) return blob;
  for (const key of keys) {
    const result = decryptWithKey(blob, key);
    if (result !== undefined) return result; // 성공 or 구조 오류(null)
  }
  return undefined; // 모든 키 실패 → 복구 불가
}

async function main() {
  const currentKeyB64 = process.env.KMS_LOCAL_KEY || process.env.MASTER_KEY_BASE64;
  if (!currentKeyB64) throw new Error('KMS_LOCAL_KEY not set');

  const currentKey = Buffer.from(currentKeyB64, 'base64');
  if (currentKey.length !== 32) throw new Error(`KMS_LOCAL_KEY must be 32 bytes, got ${currentKey.length}`);

  const prev1B64 = process.env.KMS_LOCAL_KEY_PREV1;
  const prev2B64 = process.env.KMS_LOCAL_KEY_PREV2;

  const allKeys = [currentKey];
  if (prev1B64) {
    const k = Buffer.from(prev1B64, 'base64');
    if (k.length === 32) allKeys.push(k);
    else console.warn('KMS_LOCAL_KEY_PREV1 invalid length, skipping');
  }
  if (prev2B64) {
    const k = Buffer.from(prev2B64, 'base64');
    if (k.length === 32) allKeys.push(k);
    else console.warn('KMS_LOCAL_KEY_PREV2 invalid length, skipping');
  }

  console.log(`키 로드 완료: ${allKeys.length}개 (현재 1 + 폴백 ${allKeys.length - 1})`);

  const dbUrl = process.env.DATABASE_URL?.replace('@cleanerp-postgres:', '@localhost:')
    ?? `postgresql://cleanerp:tV7FRpcWgD+G+1r+YqW5L85ajaX9OIFnFaIRsmZFaA8@localhost:5434/cleanerp_prod`;

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  console.log('DB 연결 성공\n');

  let fixed = 0;
  let irrecoverable = 0;
  let skipped = 0;

  // ─── users.bank_account / address ───────────────────────────────────────
  console.log('=== users 테이블 처리 ===');
  const usersRes = await client.query(
    `SELECT id, bank_account, address FROM users WHERE bank_account LIKE 'v1:%' OR address LIKE 'v1:%'`
  );
  console.log(`대상 행: ${usersRes.rows.length}개`);

  for (const row of usersRes.rows) {
    const id = row.id;
    const updates = {};
    let changed = false;

    // bank_account
    if (row.bank_account?.startsWith('v1:')) {
      if (id === 341) {
        // 복구 불가 — 4번째 키로 암호화됨
        console.log(`  [IRRECOVERABLE] user_id=${id} bank_account → NULL 처리`);
        updates.bank_account = null;
        changed = true;
        irrecoverable++;
      } else {
        const plain = decryptFallback(row.bank_account, allKeys);
        if (plain === undefined) {
          console.log(`  [IRRECOVERABLE] user_id=${id} bank_account → 복구 불가`);
          irrecoverable++;
        } else if (plain !== null) {
          // 현재 키로 이미 복호화 가능한지 확인
          const tryCurrentKey = decryptWithKey(row.bank_account, currentKey);
          if (tryCurrentKey !== undefined) {
            skipped++;
          } else {
            updates.bank_account = encryptWithKey(plain, currentKey);
            changed = true;
            console.log(`  [FIXED] user_id=${id} bank_account 재암호화 완료`);
            fixed++;
          }
        }
      }
    }

    // address
    if (row.address?.startsWith('v1:')) {
      const tryCurrentKey = decryptWithKey(row.address, currentKey);
      if (tryCurrentKey !== undefined) {
        // 이미 현재 키로 복호화 가능
      } else {
        const plain = decryptFallback(row.address, allKeys);
        if (plain === undefined) {
          console.log(`  [IRRECOVERABLE] user_id=${id} address → 복구 불가`);
          irrecoverable++;
        } else if (plain !== null) {
          updates.address = encryptWithKey(plain, currentKey);
          changed = true;
          console.log(`  [FIXED] user_id=${id} address 재암호화 완료`);
          fixed++;
        }
      }
    }

    if (changed) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `${k} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(updates)];
      await client.query(`UPDATE users SET ${setClauses} WHERE id = $1`, values);
    }
  }

  // ─── user_id=341 audit log ────────────────────────────────────────────────
  console.log('\n  user_id=341 감사 로그 기록...');
  console.log('  (audit_logs 테이블 없음 — 관리자에게 직접 통보 필요)');

  // ─── health_records ───────────────────────────────────────────────────────
  console.log('\n=== health_records 테이블 처리 ===');
  const hrRes = await client.query(
    `SELECT id, worker_id, bp_sys, bp_dia, heart_rate, blood_sugar,
            vision_left, vision_right, hearing_left, hearing_right, blood_type,
            allergies, chronic_conditions, emergency_contact, notes
     FROM health_records WHERE bp_sys LIKE 'v1:%'`
  );
  console.log(`대상 행: ${hrRes.rows.length}개`);

  const hrFields = [
    'bp_sys', 'bp_dia', 'heart_rate', 'blood_sugar',
    'vision_left', 'vision_right', 'hearing_left', 'hearing_right',
    'blood_type', 'allergies', 'chronic_conditions', 'emergency_contact', 'notes',
  ];

  for (const row of hrRes.rows) {
    const updates = {};
    let changed = false;

    for (const field of hrFields) {
      const blob = row[field];
      if (!blob?.startsWith('v1:')) continue;
      const tryCurrentKey = decryptWithKey(blob, currentKey);
      if (tryCurrentKey !== undefined) continue; // 이미 현재 키

      const plain = decryptFallback(blob, allKeys);
      if (plain === undefined) {
        console.log(`  [IRRECOVERABLE] health_record id=${row.id} worker_id=${row.worker_id} ${field}`);
        irrecoverable++;
      } else if (plain !== null) {
        updates[field] = encryptWithKey(plain, currentKey);
        changed = true;
      }
    }

    if (changed) {
      const setClauses = Object.entries(updates).map(([k, v], i) => `${k} = $${i + 2}`).join(', ');
      const values = [row.id, ...Object.values(updates)];
      await client.query(`UPDATE health_records SET ${setClauses} WHERE id = $1`, values);
      console.log(`  [FIXED] health_record id=${row.id} worker_id=${row.worker_id} — ${Object.keys(updates).length}개 필드 재암호화`);
      fixed += Object.keys(updates).length;
    }
  }

  await client.end();

  console.log('\n=== 완료 ===');
  console.log(`재암호화: ${fixed}개 필드`);
  console.log(`복구 불가: ${irrecoverable}개 (NULL 처리 또는 기록됨)`);
  console.log(`이미 현재 키: ${skipped}개 (건너뜀)`);
  console.log('\n⚠️  백필 완료 후 docker-compose.yml에서 KMS_LOCAL_KEY_PREV1/PREV2 제거 필요');
}

main().catch((e) => { console.error('백필 실패:', e); process.exit(1); });
