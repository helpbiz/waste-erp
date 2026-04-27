/**
 * 민원 — Plan §3-3 + §3-1 권한 매트릭스
 *
 * 입력 가능 Role: SUPER, MUNI, CONTRACTOR, INTERNAL, WORKER (모두 가능 — Plan §3-1)
 * 처리/조회 가능 Role: SUPER, MUNI, CONTRACTOR, INTERNAL (지자체는 GET-only)
 *
 * 가시범위:
 *   SUPER_ADMIN        : 전체
 *   MUNI_ADMIN         : 본인 지자체 산하 위탁업체 전체
 *   CONTRACTOR/INTERNAL: 본인 위탁업체
 *   WORKER             : 본인이 등록한 것
 */
import type { Prisma } from '@prisma/client';
import type { SessionPayload } from '@/lib/auth';

export function complaintWhere(session: SessionPayload): Prisma.ComplaintWhereInput {
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

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS:  '수거 미비',
  ILLEGAL_DUMP: '불법투기',
  ODOR_NOISE:   '악취/소음',
  BULKY_WASTE:  '대형폐기물',
  OTHER:        '기타',
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED:    '접수',
  ASSIGNED:    '배정',
  IN_PROGRESS: '처리중',
  COMPLETED:   '완료',
  REJECTED:    '반려',
};

export function complaintTypeLabel(t: string): string {
  return TYPE_LABEL[t] ?? t;
}

export function complaintStatusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

export function isOverdue(c: { dueDate: Date | null; status: string }): boolean {
  if (c.status === 'COMPLETED' || c.status === 'REJECTED') return false;
  if (!c.dueDate) return false;
  return c.dueDate.getTime() < Date.now();
}

/** 미처리 카운트 (KPI #2) — RECEIVED + ASSIGNED + IN_PROGRESS */
export const PENDING_STATUSES = ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] as const;

/** 관리자 권한 (assign/reject 가능) — Plan §3-1 + §7-1 GET-only 적용 */
export function isComplaintManager(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
}

/** start/complete 가능 — 매니저 또는 본인 담당 건 */
export function canTransitionComplaint(
  session: { role: string; userId: string },
  complaint: { assignedTo: bigint | null }
): boolean {
  if (isComplaintManager(session.role)) return true;
  if (session.role === 'WORKER' && complaint.assignedTo?.toString() === session.userId) return true;
  return false;
}
