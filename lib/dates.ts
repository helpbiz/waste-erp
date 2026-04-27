/**
 * KST 기준 시간 헬퍼.
 * 노동법 가산임금 계산이 한국 시간대 기준이므로 명시적으로 처리.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** 오늘 00:00:00 (KST) — DB date 컬럼에 저장할 work_date 용도 */
export function todayKstDate(): Date {
  const k = nowKst();
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}

/** 출근 시각의 분 단위 표현 (예: 06:00 → 360) */
export function minutesOfDayKst(d: Date): number {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

/** 지각 판정 — 06:00 이후 출근 (환경미화 새벽 근무 기준) */
export const LATE_THRESHOLD_MIN = 6 * 60;

export function isLateCheckIn(checkInTime: Date): boolean {
  return minutesOfDayKst(checkInTime) > LATE_THRESHOLD_MIN;
}

/** HH:MM 포맷 (KST) */
export function formatHmKst(d: Date): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}
