/**
 * RBAC — Plan §3-1 권한 매트릭스 + §7-1 지자체 GET-only 원칙
 *
 * 권한 계층(높을수록 강함):
 *   SUPER_ADMIN(100) > MUNI_ADMIN(80) > CONTRACTOR_ADMIN(60)
 *     > INTERNAL_ADMIN(40) > WORKER(10)
 *
 * 단, MUNI_ADMIN은 "감독자" 역할이므로 mutate 권한이 없음 (read-only).
 * 미들웨어와 API 양쪽에서 이중 강제.
 */
import type { Role } from '@prisma/client';

export const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 100,
  MUNI_ADMIN: 80,
  // muni-user-delegation 2026-08-15 — MUNI_ADMIN 산하, MUNI_ADMIN보다 낮은 랭크
  MUNI_USER: 70,
  CONTRACTOR_ADMIN: 60,
  INTERNAL_ADMIN: 40,
  WORKER: 10,
  // dealer-channel Design §3.1 — 자원 생성권 없음, 리드 등록·데모 발급 전용 최소권한.
  // 기존 5개 role 랭크·순서는 무수정.
  DEALER: 5,
};

// muni-user-delegation 2026-08-15 — MUNI_USER도 MUNI_ADMIN과 동일하게 mutate 차단(감독/조회 전용)
export const READ_ONLY_ROLES: Role[] = ['MUNI_ADMIN', 'MUNI_USER'];

/**
 * 운영데이터(근태/차량운행/실적/빼기·건의사항 등) 편집 가능 역할.
 * WORKER·MUNI 계열(감독자)은 조회 전용 — 신규 role 추가 시 이 목록에 명시적으로 추가할 것
 * (음성검사 방식은 새 role이 자동으로 관리권한을 얻는 결함을 낳음, 2026-08-15 보안검토).
 */
const OPERATIONS_MANAGER_ROLES = new Set(['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);
export function canManageOperations(role: string | null | undefined): boolean {
  return !!role && OPERATIONS_MANAGER_ROLES.has(role);
}

export function hasMinRank(actual: Role | undefined | null, required: Role): boolean {
  if (!actual) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** mutate(POST/PUT/PATCH/DELETE) 가능 여부 */
export function canMutate(role: Role): boolean {
  return !READ_ONLY_ROLES.includes(role);
}

/** 지자체 관리자도 본인 지자체 데이터만 조회 가능 */
export function canAccessMunicipality(
  session: { role: Role; municipalityId: string | null },
  municipalityId: string
): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  return session.municipalityId === municipalityId;
}

/** 위탁업체 데이터 접근 — 슈퍼는 전체, 지자체는 본인 지자체 산하만, 그 외는 본인 소속만 */
export function canAccessContractor(
  session: { role: Role; contractorId: string | null; municipalityId: string | null },
  contractorId: string,
  contractorMunicipalityId?: string | null
): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  if (session.role === 'MUNI_ADMIN' || session.role === 'MUNI_USER') {
    return !!session.municipalityId && session.municipalityId === contractorMunicipalityId;
  }
  return session.contractorId === contractorId;
}

/** 모듈별 접근 권한 (Plan §3-1 표) */
export type Module =
  | 'municipality.manage'   // 지자체 생성/관리
  | 'contractor.manage'     // 업체 등록/승인
  | 'zone.manage'           // 청소구역/행정동
  | 'account.create'        // 계정 생성
  | 'attendance.input'      // 근태 입력 (근로자)
  | 'attendance.review'     // 근태 조회/승인/조정
  | 'complaint.input'
  | 'complaint.process'
  | 'vehicle.log.input'
  | 'cost.calc'
  | 'payroll.settle'
  | 'report.view'
  | 'safety.input'
  | 'safety.manage'
  // dealer-channel Design §3.1 — DEALER 전용 최소권한 모듈. 기존 항목은 무수정.
  | 'lead.create'
  | 'lead.read.own'
  | 'demo.provision';

const MODULE_ACCESS: Record<Module, Role[]> = {
  'municipality.manage': ['SUPER_ADMIN'],
  'contractor.manage':   ['SUPER_ADMIN'],
  'zone.manage':         ['CONTRACTOR_ADMIN'],
  'account.create':      ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'attendance.input':    ['WORKER'],
  'attendance.review':   ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'complaint.input':     ['MUNI_ADMIN', 'MUNI_USER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER'],
  'complaint.process':   ['SUPER_ADMIN', 'MUNI_ADMIN', 'MUNI_USER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'vehicle.log.input':   ['WORKER'],
  'cost.calc':           ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'payroll.settle':      ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'report.view':         ['SUPER_ADMIN', 'MUNI_ADMIN', 'MUNI_USER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'safety.input':        ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'WORKER'],
  'safety.manage':       ['CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'],
  'lead.create':         ['DEALER'],
  'lead.read.own':       ['DEALER'],
  'demo.provision':      ['DEALER'],
};

export function canAccessModule(role: Role, mod: Module): boolean {
  return MODULE_ACCESS[mod].includes(role);
}
