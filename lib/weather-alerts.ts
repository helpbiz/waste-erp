/**
 * 기상악화 알림톡 공지 — Plan §3-4 + 산안법 안전수칙
 *
 * 6 유형 × 표준 템플릿 + 사용자 편집 가능
 *  - 카카오 알림톡 / SMS / Webhook 모두 동일 텍스트 사용 (provider 추상화)
 *  - 발송 결과는 audit_log + 추후 NotificationDispatch 테이블로 확장 예정
 */
export type WeatherAlertType = 'POKYUM' | 'HANPA' | 'POKWU' | 'POKSEOL' | 'GANGPUNG' | 'ETC';

export const WEATHER_ALERT_TYPES: Array<{
  key: WeatherAlertType;
  label: string;
  emoji: string;
  tone: string; // tailwind 색상 클래스 prefix
}> = [
  { key: 'POKYUM',   label: '폭염',   emoji: '☀️', tone: 'orange' },
  { key: 'HANPA',    label: '한파',   emoji: '❄️', tone: 'sky' },
  { key: 'POKWU',    label: '폭우',   emoji: '☂️', tone: 'indigo' },
  { key: 'POKSEOL',  label: '폭설',   emoji: '🌨', tone: 'cyan' },
  { key: 'GANGPUNG', label: '강풍',   emoji: '🌀', tone: 'violet' },
  { key: 'ETC',      label: '기타',   emoji: '📢', tone: 'rose' },
];

export const WEATHER_ALERT_TEMPLATES: Record<WeatherAlertType, string> = {
  POKYUM:
`[기상 안전 공지]
폭염 특보 또는 고온 현상이 예상됩니다.

현장 근무자는 온열질환 예방수칙을 준수하여 주시기 바랍니다.
특히 옥외작업 시 충분한 수분 섭취, 휴식시간 확보, 보호장비 점검 등 개인 건강관리에 유의해 주세요.

위급상황 발생 시 즉시 119 또는 관리자에게 신고 바랍니다.`,

  HANPA:
`[기상 안전 공지]
한파 특보 또는 강한 추위가 예상됩니다.

현장 근무자는 동상·저체온증 예방을 위해 방한복 착용을 점검해 주십시오.
옥외작업 시 작업시간 단축, 따뜻한 음료 섭취, 정기 휴식을 권장합니다.

이상 증상(손발 저림·창백·구토 등) 발생 시 즉시 119 또는 관리자에게 신고 바랍니다.`,

  POKWU:
`[기상 안전 공지]
호우 특보 또는 집중호우가 예상됩니다.

현장 근무자는 미끄럼 사고 예방을 위해 안전화·우비 착용을 점검해 주세요.
침수 위험지역 작업은 즉시 중단하고, 차량 운행 시 서행 운전 바랍니다.
배수로·맨홀 주변은 특히 유의하여 주십시오.

위급상황 발생 시 즉시 119 또는 관리자에게 신고 바랍니다.`,

  POKSEOL:
`[기상 안전 공지]
대설 특보 또는 폭설이 예상됩니다.

현장 근무자는 빙판 미끄럼 사고에 유의해 주세요.
차량 운행 시 스노타이어·체인 점검 후 서행 운전 바랍니다.
야외 장시간 노출을 자제하시고 정기 휴식 확보를 권장합니다.

위급상황 발생 시 즉시 119 또는 관리자에게 신고 바랍니다.`,

  GANGPUNG:
`[기상 안전 공지]
강풍 특보 또는 강한 바람이 예상됩니다.

고소작업·리프트 작업은 즉시 중단해 주세요.
비산물(간판·낙하물) 주의, 차량 운행 시 핸들을 단단히 잡고 서행 운전 바랍니다.
적재함 결박 상태를 반드시 점검해 주십시오.

위급상황 발생 시 즉시 119 또는 관리자에게 신고 바랍니다.`,

  ETC: '',
};

export const WEATHER_ALERT_LABEL: Record<WeatherAlertType, string> = {
  POKYUM: '폭염',
  HANPA: '한파',
  POKWU: '폭우',
  POKSEOL: '폭설',
  GANGPUNG: '강풍',
  ETC: '기타',
};

export function templateFor(t: WeatherAlertType): string {
  return WEATHER_ALERT_TEMPLATES[t] ?? '';
}
