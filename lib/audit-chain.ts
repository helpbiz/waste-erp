/**
 * Append-only 감사 체인 (security-architect 권고)
 *
 * - 각 조정 레코드는 직전 행의 thisHash를 prevHash로 가짐
 * - thisHash = SHA-256( prevHash | canonical(payload) )
 * - 한 칸 위변조 시 이후 모든 thisHash가 깨짐 → 노동청 감사 시 무결성 증명
 *
 * 운영 마이그레이션: REVOKE UPDATE, DELETE ON attendance_adjustments FROM app_user;
 */
import { createHash } from 'crypto';

const GENESIS_HASH = '0'.repeat(64);

/** 객체를 키 정렬한 후 JSON 직렬화 (체인 정합성 보장) */
function canonicalize(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = payload[k];
  return JSON.stringify(ordered);
}

export function computeHash(prevHash: string | null, payload: Record<string, unknown>): string {
  const prev = prevHash ?? GENESIS_HASH;
  const input = prev + '|' + canonicalize(payload);
  return createHash('sha256').update(input).digest('hex');
}

export type ChainLink = {
  id: bigint | string;
  prevHash: string | null;
  thisHash: string;
  payload: Record<string, unknown>;
};

export type ChainVerifyResult =
  | { valid: true; length: number }
  | { valid: false; brokenAt: number; reason: 'prev_mismatch' | 'hash_mismatch' };

/** 체인 무결성 검증 — 입력은 createdAt 오름차순 정렬되어야 함 */
export function verifyChain(links: ChainLink[]): ChainVerifyResult {
  let prev: string | null = null;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const expectedPrev = i === 0 ? null : prev;
    if ((link.prevHash ?? null) !== expectedPrev) {
      return { valid: false, brokenAt: i, reason: 'prev_mismatch' };
    }
    const expected = computeHash(expectedPrev, link.payload);
    if (expected !== link.thisHash) {
      return { valid: false, brokenAt: i, reason: 'hash_mismatch' };
    }
    prev = link.thisHash;
  }
  return { valid: true, length: links.length };
}
