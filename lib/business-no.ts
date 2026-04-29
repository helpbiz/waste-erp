/**
 * 한국 사업자등록번호 (10자리) 유틸.
 *
 * 형식: XXX-XX-XXXXX
 *   - 첫 3자리: 세무서 코드 (101 ~ 9XX, 000 / 999 / all-zero 등은 무효)
 *   - 다음 2자리: 개인/법인 구분 코드
 *   - 다음 4자리: 일련번호
 *   - 마지막 1자리: 체크 디지트 (국세청 modulo 알고리즘)
 *
 * Reference: 국세청 사업자등록번호 검증 공식 알고리즘.
 */

/** 입력값을 자동으로 XXX-XX-XXXXX 포맷팅 (숫자 외 제거, 10자리 cap). */
export function formatBusinessNo(value: string): string {
  const d = (value ?? '').replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 사업자번호 유효성 검증.
 *  - reason: 무효 시 사용자에게 표시할 한국어 사유 */
export function validateBusinessNo(value: string): { valid: boolean; reason?: string } {
  const d = (value ?? '').replace(/\D/g, '');
  if (d.length === 0) return { valid: false, reason: '사업자번호를 입력하세요' };
  if (d.length !== 10) return { valid: false, reason: `10자리 숫자 필요 (현재 ${d.length}자리)` };

  /* 세무서 코드 (첫 3자리) — 000 / 999 / all-zero 같은 명백한 오류 차단.
     국세청은 코드를 시간에 따라 추가/변경하므로 화이트리스트가 아닌
     'obvious invalid' 만 차단하는 보수적 방식 사용. */
  const taxOffice = d.slice(0, 3);
  if (taxOffice === '000') return { valid: false, reason: '세무서 코드(첫 3자리) 오류 — 000 무효' };
  if (/^(\d)\1{9}$/.test(d)) return { valid: false, reason: '동일 숫자 반복 — 무효한 번호' };

  /* 체크 디지트 검증 (국세청 공식) */
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * weights[i];
  /* 9번째 자리(인덱스 8)에 가중치 5 곱한 결과의 10의 자릿수를 추가 */
  sum += Math.floor((Number(d[8]) * 5) / 10);
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== Number(d[9])) {
    return { valid: false, reason: '체크 디지트 불일치 — 사업자번호 확인 필요' };
  }
  return { valid: true };
}
