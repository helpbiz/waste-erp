/**
 * 산업안전보건 — Plan §3-4 + 산안법 §54/§57
 *
 * 보고 기한 자동 계산:
 *  - FATAL/SEVERE → 24시간 (산안법 §54)
 *  - INJURY       → 30일   (산안법 §57)
 *  - 그 외        → 보고 의무 없음
 */
import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/auth';

export const DAILY_CHECKLIST_ITEMS = [
  { key: 'helmet', label: '안전모 착용' },
  { key: 'vest',   label: '안전조끼·반사조끼' },
  { key: 'glove',  label: '안전장갑' },
  { key: 'shoes',  label: '안전화' },
  { key: 'tire',   label: '차량 타이어 점검' },
  { key: 'brake',  label: '브레이크·등화 점검' },
  { key: 'lift',   label: '리프트·압축장치' },
] as const;

export type ChecklistItem = { key: string; label: string; ok: boolean };

export function safetyWhere(session: SessionPayload): Prisma.SafetyReportWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.role === 'WORKER') {
    return { reportedBy: BigInt(session.userId) };
  }
  if (session.contractorId) {
    return { contractorId: BigInt(session.contractorId) };
  }
  return { id: -1n };
}

export function isSafetyManager(role: string): boolean {
  /* MUNI_ADMIN: 감독 역할로 검토(REVIEWED) / 지자체 보고(MOL_REPORTED) / 종결(RESOLVED) 허용 */
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN' || role === 'MUNI_ADMIN';
}

/** 사고 발생 시각 + 심각도로 고용노동부 보고 기한 계산 */
export function computeMolDeadline(
  severity: string,
  occurredAt: Date | null
): Date | null {
  if (!occurredAt) return null;
  const t = occurredAt.getTime();
  if (severity === 'FATAL' || severity === 'SEVERE') {
    return new Date(t + 24 * 3600 * 1000);
  }
  if (severity === 'INJURY') {
    return new Date(t + 30 * 24 * 3600 * 1000);
  }
  return null;
}

const SEVERITY_LABEL: Record<string, string> = {
  NONE: '일반',
  MINOR: '경미',
  INJURY: '부상',
  SEVERE: '중상',
  FATAL: '사망',
};
const TYPE_LABEL: Record<string, string> = {
  DAILY_CHECKLIST: '일일점검',
  NEAR_MISS: '아차사고',
  INCIDENT: '재해 발생',
  TBM_SIGNATURE: 'TBM 서명',
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '접수',
  REVIEWED: '검토 완료',
  MOL_REPORTED: '고용노동부 보고',
  RESOLVED: '종결',
};

export function severityLabel(s: string): string { return SEVERITY_LABEL[s] ?? s; }
export function safetyTypeLabel(t: string): string { return TYPE_LABEL[t] ?? t; }
export function safetyStatusLabel(s: string): string { return STATUS_LABEL[s] ?? s; }

export function isMolReportable(severity: string): boolean {
  return severity === 'FATAL' || severity === 'SEVERE' || severity === 'INJURY';
}
