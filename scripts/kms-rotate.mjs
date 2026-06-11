#!/usr/bin/env node
/**
 * KMS 키 교체 스크립트 — 현재 키 → 새 키로 전체 재암호화
 * 실행: NEW_KMS_KEY=<base64> node scripts/kms-rotate.mjs
 *
 * ⚠️  실행 전 DB 백업 권장.
 * ⚠️  password_hash·username 등 인증 데이터는 절대 건드리지 않음.
 *     오직 v1: 프리픽스 PII 필드(bank_account, address, health_records)만 처리.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// .env 로드
try {
  const lines = readFileSync(resolve(import.meta.dirname, '../.env'), 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env 없으면 환경변수 직접 사용 */ }

const ALGO = 'aes-256-gcm';
const V = 'v1';

const currentKeyB64 = process.env.KMS_LOCAL_KEY || process.env.MASTER_KEY_BASE64;
const newKeyB64 = process.env.NEW_KMS_KEY;

if (!currentKeyB64) { console.error('KMS_LOCAL_KEY 미설정'); process.exit(1); }
if (!newKeyB64) { console.error('NEW_KMS_KEY 미설정. NEW_KMS_KEY=<base64> 로 실행'); process.exit(1); }

const currentKey = Buffer.from(currentKeyB64, 'base64');
const newKey = Buffer.from(newKeyB64, 'base64');
if (currentKey.length !== 32 || newKey.length !== 32) {
  console.error('키는 반드시 32바이트여야 합니다'); process.exit(1);
}
if (currentKeyB64 === newKeyB64) { console.error('새 키가 현재 키와 동일합니다'); process.exit(1); }

function decrypt(blob) {
  if (!blob?.startsWith(`${V}:`)) return blob ?? null;
  const [, iv, tag, ct] = blob.split(':');
  const dec = createDecipheriv(ALGO, currentKey, Buffer.from(iv, 'base64'));
  dec.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([dec.update(Buffer.from(ct, 'base64')), dec.final()]).toString('utf8');
}

function encrypt(plain) {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, newKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${V}:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

async function rotateTable(client, table, pkCol, fields, whereClause) {
  const cols = fields.join(', ');
  const res = await client.query(`SELECT ${pkCol}, ${cols} FROM ${table} WHERE ${whereClause}`);
  console.log(`  [${table}] 대상 ${res.rows.length}행`);
  let rotated = 0;
  for (const row of res.rows) {
    const updates = {};
    for (const f of fields) {
      if (!row[f]?.startsWith(`${V}:`)) continue;
      updates[f] = encrypt(decrypt(row[f]));
    }
    if (!Object.keys(updates).length) continue;
    const set = Object.keys(updates).map((k, i) => `${k}=$${i + 2}`).join(', ');
    await client.query(`UPDATE ${table} SET ${set} WHERE ${pkCol}=$1`, [row[pkCol], ...Object.values(updates)]);
    rotated += Object.keys(updates).length;
  }
  console.log(`  [${table}] ${rotated}개 필드 교체 완료`);
  return rotated;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.replace('@cleanerp-postgres:', '@localhost:') ??
    'postgresql://cleanerp:tV7FRpcWgD+G+1r+YqW5L85ajaX9OIFnFaIRsmZFaA8@localhost:5434/cleanerp_prod';
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  console.log('DB 연결 완료\n현재 키:', currentKeyB64.slice(0, 12) + '...  →  새 키:', newKeyB64.slice(0, 12) + '...\n');

  let total = 0;

  // users: bank_account, address
  total += await rotateTable(client, 'users', 'id', ['bank_account', 'address'],
    `bank_account LIKE 'v1:%' OR address LIKE 'v1:%'`);

  // health_records: 모든 암호화 필드
  total += await rotateTable(client, 'health_records', 'id',
    ['bp_sys','bp_dia','heart_rate','blood_sugar','vision_left','vision_right',
     'hearing_left','hearing_right','blood_type','allergies','chronic_conditions','emergency_contact','notes'],
    `bp_sys LIKE 'v1:%'`);

  // live_tracking_configs: api_key_enc
  total += await rotateTable(client, 'live_tracking_configs', 'id', ['api_key_enc'],
    `api_key_enc LIKE 'v1:%'`);

  await client.end();
  console.log(`\n완료: 총 ${total}개 필드 새 키로 재암호화`);

  // 복호화 검증 (새 키로)
  console.log('\n검증 중...');
  const verifyClient = new pg.Client({ connectionString: dbUrl });
  await verifyClient.connect();
  const sample = await verifyClient.query(`SELECT id, bank_account FROM users WHERE bank_account LIKE 'v1:%' LIMIT 3`);
  for (const row of sample.rows) {
    try {
      const [, iv, tag, ct] = row.bank_account.split(':');
      const dec = createDecipheriv(ALGO, newKey, Buffer.from(iv, 'base64'));
      dec.setAuthTag(Buffer.from(tag, 'base64'));
      const plain = Buffer.concat([dec.update(Buffer.from(ct, 'base64')), dec.final()]).toString('utf8');
      console.log(`  ✅ user_id=${row.id} → ${plain.slice(0, 6)}...`);
    } catch (e) { console.log(`  ❌ user_id=${row.id} 검증 실패: ${e.message}`); }
  }
  await verifyClient.end();
}

main().catch(e => { console.error('오류:', e); process.exit(1); });
