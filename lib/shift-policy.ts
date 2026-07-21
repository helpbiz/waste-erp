/**
 * 근무유형(주간/야간/새벽)별 출퇴근 인정시간 정책 — 회사 전체 / 부서(팀) / 개인 3단계.
 * 적용 우선순위: 개인에 활성 정책이 하나라도 있으면 개인 것만 사용, 없으면 부서, 그마저 없으면 회사 전체.
 * 2026-07-21 결정: 정책 변경은 소급 재판정하지 않음 — 이 모듈은 항상 "지금 이 순간" 판정에만 쓴다.
 */
import { prisma } from '@/lib/db';
import { minutesOfDayKst } from '@/lib/dates';

export type ShiftPolicyRow = {
  id: bigint;
  shiftType: 'DAY' | 'NIGHT' | 'DAWN';
  name: string;
  checkInRecognizeFrom: string | null;
  checkInRecognizeUntil: string | null;
  checkOutRecognizeFrom: string | null;
  checkOutRecognizeUntil: string | null;
  checkOutNextDay: boolean;
  offDays: string | null;
};

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 개인 > 부서 > 회사 전체 순으로, 가장 구체적인 스코프에서 활성 정책이 있으면 그것만 반환 */
export async function resolveShiftPolicies(
  contractorId: bigint,
  workerId: bigint,
  departmentId: bigint | null
): Promise<ShiftPolicyRow[]> {
  const individual = await prisma.shiftPolicy.findMany({ where: { contractorId, workerId, active: true } });
  if (individual.length > 0) return individual;

  if (departmentId != null) {
    const dept = await prisma.shiftPolicy.findMany({
      where: { contractorId, departmentId, workerId: null, active: true },
    });
    if (dept.length > 0) return dept;
  }

  return prisma.shiftPolicy.findMany({
    where: { contractorId, departmentId: null, workerId: null, active: true },
  });
}

/** 이 정책 기준으로 해당 요일(0=월~6=일)이 휴무인지 */
export function isOffDay(policy: Pick<ShiftPolicyRow, 'offDays'>, kstDayOfWeek: number): boolean {
  if (!policy.offDays) return false;
  try {
    const days: number[] = JSON.parse(policy.offDays);
    return days.includes(kstDayOfWeek);
  } catch {
    return false;
  }
}

/** 체크인 시각이 어느 정책의 출근 인정창 안에 드는지 찾는다(자정 걸침 창 지원) */
export function matchPolicyForCheckIn(policies: ShiftPolicyRow[], checkInAt: Date): ShiftPolicyRow | null {
  const mins = minutesOfDayKst(checkInAt);
  for (const p of policies) {
    if (!p.checkInRecognizeFrom || !p.checkInRecognizeUntil) continue;
    const from = hhmmToMinutes(p.checkInRecognizeFrom);
    const until = hhmmToMinutes(p.checkInRecognizeUntil);
    if (from <= until) {
      if (mins >= from && mins <= until) return p;
    } else if (mins >= from || mins <= until) {
      return p;
    }
  }
  return null;
}

/** 매치된 정책의 출근 인정 종료시각 초과 시 지각 */
export function isLateByPolicy(policy: ShiftPolicyRow, checkInAt: Date): boolean {
  if (!policy.checkInRecognizeUntil) return false;
  return minutesOfDayKst(checkInAt) > hhmmToMinutes(policy.checkInRecognizeUntil);
}

/**
 * 매치된 정책의 퇴근 인정 시작시각 미달 시 조퇴.
 * NIGHT + checkOutNextDay=true 인 정책은 퇴근이 "익일"에 일어나는 게 정상이므로,
 * 호출측(체크아웃 API)에서 실제 경과일수를 확인해 다음날 퇴근이면 이 함수로 그 시각만 비교하면 된다.
 */
export function isEarlyLeaveByPolicy(policy: ShiftPolicyRow, checkOutAt: Date): boolean {
  if (!policy.checkOutRecognizeFrom) return false;
  return minutesOfDayKst(checkOutAt) < hhmmToMinutes(policy.checkOutRecognizeFrom);
}
