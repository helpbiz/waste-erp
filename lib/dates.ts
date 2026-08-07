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

/**
 * "YYYY-MM-DD" 문자열을 그 날짜의 work_date 컬럼 값과 정확히 같은 시점(UTC 00:00)으로 변환.
 * `new Date(dateStr + 'T00:00:00')`는 런타임 타임존이 KST면 파싱 시점에 -9시간이 적용되어
 * UTC 날짜가 하루 앞으로 밀리는 버그가 있음(예: 서버 TZ=Asia/Seoul일 때 '2026-08-06' 조회가
 * 실제로는 work_date='2026-08-05' 레코드를 가져옴) — 반드시 Date.UTC로 직접 구성해야 함.
 */
export function parseKstDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
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

/**
 * 브라우저 클라이언트 전용 — 시스템 로컬 시각(KST) 기준 YYYY-MM-DD
 * toISOString()은 UTC 기준이므로 자정~오전 9시에 전날 날짜를 반환하는 문제를 방지.
 */
export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 브라우저 클라이언트 전용 — 로컬 기준 YYYY-MM */
export function thisMonthLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** HH:MM 포맷 (KST) */
export function formatHmKst(d: Date): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}
