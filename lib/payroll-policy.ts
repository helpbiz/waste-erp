/**
 * 급여 정책 — 위탁업체별 연장/야간/휴일 기준시간 관리
 * PayrollPolicy 레코드가 없으면 아래 DEFAULT를 사용한다.
 */
import { prisma } from '@/lib/db';

export type PayrollPolicyData = {
  dailyWorkHours: number;
  nightStartHour: number;
  nightEndHour: number;
  overtimeMultiplier: number;
  nightMultiplier: number;
  holidayMultiplier: number;
  payslipApproverId: string | null; // 결재승인권자 userId (null = 승인 없이 발송 가능)
};

export const DEFAULT_POLICY: PayrollPolicyData = {
  dailyWorkHours: 8,
  nightStartHour: 22,
  nightEndHour: 6,
  overtimeMultiplier: 1.5,
  nightMultiplier: 0.5,
  holidayMultiplier: 1.5,
  payslipApproverId: null,
};

export async function getPayrollPolicy(contractorId: bigint): Promise<PayrollPolicyData> {
  const row = await prisma.payrollPolicy.findUnique({ where: { contractorId } });
  if (!row) return DEFAULT_POLICY;
  return {
    dailyWorkHours: Number(row.dailyWorkHours),
    nightStartHour: row.nightStartHour,
    nightEndHour: row.nightEndHour,
    overtimeMultiplier: Number(row.overtimeMultiplier),
    nightMultiplier: Number(row.nightMultiplier),
    holidayMultiplier: Number(row.holidayMultiplier),
    payslipApproverId: row.payslipApproverId?.toString() ?? null,
  };
}

/**
 * clock_in/clock_out 시간에서 야간근로 시간을 계산한다.
 * 야간 구간: [nightStartHour, 24h) ∪ [0h, nightEndHour)
 * 예) 22:00~06:00 설정 → 22시~익일6시 = 8시간
 *
 * checkIn/checkOut은 UTC DateTime. KST(+9) 기준으로 계산.
 */
export function calcNightHours(
  checkIn: Date,
  checkOut: Date,
  nightStartHour: number,
  nightEndHour: number,
): number {
  const totalMs = checkOut.getTime() - checkIn.getTime();
  if (totalMs <= 0) return 0;

  const KST_OFFSET = 9 * 3600000;
  const inKst = new Date(checkIn.getTime() + KST_OFFSET);

  // 출근 시각을 자정 기준 분으로 환산
  const startMin = inKst.getUTCHours() * 60 + inKst.getUTCMinutes();
  const durationMin = Math.round(totalMs / 60000);
  const endMin = startMin + durationMin;

  // 야간 구간 길이 (자정 넘어가는 경우 처리)
  const ns = nightStartHour * 60;
  const nightDurationMin =
    nightEndHour <= nightStartHour
      ? (24 - nightStartHour + nightEndHour) * 60
      : (nightEndHour - nightStartHour) * 60;
  const ne = ns + nightDurationMin;

  // 근무 구간이 여러 날에 걸칠 수 있으므로 24h 오프셋 3개(전날·당일·다음날) 모두 확인
  let totalNight = 0;
  for (const offset of [-1440, 0, 1440]) {
    const nStart = ns + offset;
    const nEnd = ne + offset;
    const overlap = Math.min(endMin, nEnd) - Math.max(startMin, nStart);
    if (overlap > 0) totalNight += overlap;
  }

  // 실제 근무시간을 초과할 수 없음
  return Math.min(totalNight, durationMin) / 60;
}
