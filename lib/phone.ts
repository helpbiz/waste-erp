/**
 * 한국 전화번호 자동 하이픈 포맷터.
 * 사용자가 숫자만 입력해도 010-1234-5678 / 02-123-4567 형식으로 자동 정렬.
 * 비숫자 문자는 모두 제거. 최대 11자리까지.
 *
 * 패턴:
 *  - 02 (서울): 02-XXX-XXXX (9자리) / 02-XXXX-XXXX (10자리)
 *  - 010, 011, 016~019, 070, 050x: AAA-BBBB-CCCC (11자리) / AAA-BBB-CCCC (10자리)
 *  - 0XX (지역): AAA-BBB-CCCC (10자리) / AAA-BBBB-CCCC (11자리)
 */
export function formatKoreanPhone(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length < 4) return digits;

  // 서울 02
  if (digits.startsWith('02')) {
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // 그 외 (010, 0XX 지역, 050x, 070 등) — 3자리 prefix
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
