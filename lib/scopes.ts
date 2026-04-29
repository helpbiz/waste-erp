/**
 * 가시 범위 (Scope) 헬퍼 — 권한별 데이터 격리.
 *
 * 모든 모델에 공통 적용되는 패턴:
 *  - SUPER_ADMIN: 전체 조회
 *  - MUNI_ADMIN: 본인 지자체 산하 위탁업체 전체 (read-only — middleware 차단)
 *  - CONTRACTOR_ADMIN / INTERNAL_ADMIN: 본인 위탁업체 한정
 *  - WORKER: 본인 데이터만 (또는 페이지에서 별도 처리)
 *
 * Design Ref: docs/specs/08_역할권한_설계서.md §4 권한 매트릭스.
 * 사용자 진단 2026-04-29: 용산구 MUNI 가 다른 회사 데이터까지 보던 버그 — MUNI 필터 누락.
 */
import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/auth';

/** AttendanceRecord / VehicleLog / 기타 contractorId 컬럼 가진 모델용. */
export function contractorScopeWhere(session: SessionPayload):
  | { contractorId?: bigint; contractor?: { municipalityId: bigint }; id?: bigint } {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { contractor: { municipalityId: BigInt(session.municipalityId) } };
  }
  if (session.contractorId) {
    return { contractorId: BigInt(session.contractorId) };
  }
  return { id: BigInt(-1) }; // 안전 fallback (no match)
}

/** Contractor 테이블 자체 조회 시 (지자체 산하 회사 목록 등). */
export function ownContractorWhere(session: SessionPayload): Prisma.ContractorWhereInput {
  if (session.role === 'SUPER_ADMIN') return {};
  if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    return { municipalityId: BigInt(session.municipalityId) };
  }
  if (session.contractorId) {
    return { id: BigInt(session.contractorId) };
  }
  return { id: BigInt(-1) };
}
