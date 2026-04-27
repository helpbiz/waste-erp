/**
 * 차량 운행일지 — Plan §2-4 + §3-1 권한 매트릭스
 *
 * 입력: WORKER (driver)
 * 승인/조회: SUPER, MUNI(GET-only), CONTRACTOR_ADMIN, INTERNAL_ADMIN
 * Workflow: DRAFT → SUBMITTED → APPROVED  (또는 SUBMITTED → DRAFT 반려)
 */
import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/auth';

export function vehicleLogWhere(session: SessionPayload): Prisma.VehicleLogWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { vehicle: { contractor: { municipalityId: BigInt(session.municipalityId) } } };
  }
  if (session.role === 'WORKER') {
    /* 본인 작성분 또는 본인 위탁업체 운행 (참고용 표시 가능) — 본인 것만 */
    return { driverId: BigInt(session.userId) };
  }
  if (session.contractorId) {
    return { vehicle: { contractorId: BigInt(session.contractorId) } };
  }
  return { id: -1n };
}

export function vehicleWhere(session: SessionPayload): Prisma.VehicleWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.contractorId) return { contractorId: BigInt(session.contractorId) };
  return { id: -1n };
}

export function isVehicleLogManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중',
  SUBMITTED: '제출',
  APPROVED: '승인',
};

export function vehicleLogStatusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}
