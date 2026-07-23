/**
 * 근무유형(주간/야간/새벽)별 출퇴근 인정시간 정책 — 회사 전체 / 부서(팀) / 개인 3단계.
 * 적용 우선순위: 개인에 활성 정책이 하나라도 있으면 개인 것만 사용, 없으면 부서, 그마저 없으면 회사 전체.
 * 같은 scope·shiftType 안에서도 dayOfWeekOverride(0=월~6=일)로 특정 요일(예: 토요일) 전용
 * 인정시간을 따로 둘 수 있음 — 해당 요일 오버라이드가 있으면 그걸, 없으면 기본(override=null)을 쓴다.
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
  dayOfWeekOverride: number | null;
};

export type RecognitionStatus = 'EARLY' | 'NORMAL' | 'LATE' | 'DELAYED';

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

/** 이 정책 그룹(같은 scope) 기준으로 해당 요일이 휴무인지 — offDays는 dayOfWeekOverride 무관하게 같은 shiftType 기본행에 설정 */
export function isOffDay(policies: ShiftPolicyRow[], kstDayOfWeek: number): boolean {
  const base = policies.find((p) => p.offDays);
  if (!base?.offDays) return false;
  try {
    const days: number[] = JSON.parse(base.offDays);
    return days.includes(kstDayOfWeek);
  } catch {
    return false;
  }
}

/** 같은 shiftType 안에서 오늘 요일에 맞는 "유효 정책"을 고른다 — 오버라이드 우선, 없으면 기본(null) */
function effectivePoliciesForToday(policies: ShiftPolicyRow[], kstDayOfWeek: number): ShiftPolicyRow[] {
  const byShiftType = new Map<string, ShiftPolicyRow[]>();
  for (const p of policies) {
    const list = byShiftType.get(p.shiftType) ?? [];
    list.push(p);
    byShiftType.set(p.shiftType, list);
  }
  const effective: ShiftPolicyRow[] = [];
  for (const list of byShiftType.values()) {
    const override = list.find((p) => p.dayOfWeekOverride === kstDayOfWeek);
    const base = list.find((p) => p.dayOfWeekOverride == null);
    if (override) effective.push(override);
    else if (base) effective.push(base);
  }
  return effective;
}

/**
 * 이 워커에게 적용할 "오늘의 유효 정책"을 고른다(요일 오버라이드 반영).
 * 근무유형이 여러 개 설정돼 있으면(예: 낮/밤 교대 가능) 실제 체크인 시각이 속하는 인정창을 우선,
 * 어느 창에도 안 들면(조기/지각) 창이 정의된 첫 유효 정책을 기본 판정 기준으로 사용한다.
 */
export function matchPolicyForCheckIn(policies: ShiftPolicyRow[], checkInAt: Date): ShiftPolicyRow | null {
  const effective = effectivePoliciesForToday(policies, kstDayOfWeekOf(checkInAt));
  const withWindow = effective.filter((p) => p.checkInRecognizeFrom && p.checkInRecognizeUntil);
  if (withWindow.length === 0) return null;

  const mins = minutesOfDayKst(checkInAt);
  for (const p of withWindow) {
    const from = hhmmToMinutes(p.checkInRecognizeFrom!);
    const until = hhmmToMinutes(p.checkInRecognizeUntil!);
    const inWindow = from <= until ? mins >= from && mins <= until : mins >= from || mins <= until;
    if (inWindow) return p;
  }
  return withWindow[0];
}

function kstDayOfWeekOf(d: Date): number {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return (kst.getUTCDay() + 6) % 7; // 0=월 ~ 6=일
}

/** 체크인 판정 — 인정 시작 이전=조기, 종료 초과=지각, 그 사이=정상 */
export function classifyCheckIn(policy: ShiftPolicyRow, checkInAt: Date): RecognitionStatus {
  const mins = minutesOfDayKst(checkInAt);
  if (policy.checkInRecognizeFrom && mins < hhmmToMinutes(policy.checkInRecognizeFrom)) return 'EARLY';
  if (policy.checkInRecognizeUntil && mins > hhmmToMinutes(policy.checkInRecognizeUntil)) return 'LATE';
  return 'NORMAL';
}

/** 체크아웃 판정 — 인정 시작 이전=조기(조퇴), 종료 초과=지연, 그 사이=정상.
 * 야간(checkOutNextDay) 여부와 무관하게 시:분만 비교(호출측이 이미 올바른 날짜의 기록을 다루고 있다는 전제). */
export function classifyCheckOut(policy: ShiftPolicyRow, checkOutAt: Date): RecognitionStatus {
  const mins = minutesOfDayKst(checkOutAt);
  if (policy.checkOutRecognizeFrom && mins < hhmmToMinutes(policy.checkOutRecognizeFrom)) return 'EARLY';
  if (policy.checkOutRecognizeUntil && mins > hhmmToMinutes(policy.checkOutRecognizeUntil)) return 'DELAYED';
  return 'NORMAL';
}
