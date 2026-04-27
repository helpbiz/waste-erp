/**
 * 기상 정보 (Phase 1B Mock 구현)
 *  - 운영 단계: 기상청 API (KMA) 또는 OpenWeather 연동 + 캐시
 *  - 시안 단계: 일자/시각 기반 deterministic 시뮬레이션
 *
 * 위험도 자동 판정 — 폐기물 작업 안전 가이드 기반
 *  - DANGER: 폭염(체감 33°C↑), 폭염경보, 미세먼지 매우나쁨, 강풍경보
 *  - WARN:   폭염주의보(31°C↑), 한파주의보(-10°C↓), 미세먼지 나쁨
 *  - CAUTION: 비 + 미세먼지 보통
 */
export type WeatherCondition = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' | 'STORM';
export type HazardLevel = 'NONE' | 'CAUTION' | 'WARN' | 'DANGER';
export type DustLevel = 'GOOD' | 'MODERATE' | 'BAD' | 'VERY_BAD';

export type WeatherSnapshot = {
  region: string;
  observedAt: string;
  temp: number;
  feelsLike: number;
  condition: WeatherCondition;
  conditionLabel: string;
  humidity: number;
  windSpeed: number;
  pm10: number;
  pm10Level: DustLevel;
  pm10Label: string;
  hazardLevel: HazardLevel;
  hazardLabel: string;
  hazardReason: string | null;
  workAdvice: string;
};

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  CLEAR: '맑음',
  CLOUDY: '흐림',
  RAIN: '비',
  SNOW: '눈',
  STORM: '폭풍',
};
const DUST_LABEL: Record<DustLevel, string> = {
  GOOD: '좋음',
  MODERATE: '보통',
  BAD: '나쁨',
  VERY_BAD: '매우 나쁨',
};
const HAZARD_LABEL: Record<HazardLevel, string> = {
  NONE: '정상',
  CAUTION: '주의',
  WARN: '경보',
  DANGER: '위험',
};

export function getCurrentWeather(): WeatherSnapshot {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const day = now.getUTCDate();
  const month = now.getUTCMonth() + 1;

  // 계절별 기준 온도 (서울 강남구 평균)
  const seasonBase = month >= 6 && month <= 8 ? 27 : month >= 12 || month <= 2 ? 0 : 16;
  const dayDelta = (day % 7) - 3; // ±3°C
  const hourBoost = -5 * Math.cos(((kstHour - 5) * Math.PI) / 12);
  const temp = Math.round((seasonBase + dayDelta + hourBoost) * 10) / 10;

  const condition: WeatherCondition =
    day % 13 === 0 ? 'STORM' :
    day % 5 === 0 ? 'RAIN' :
    day % 3 === 0 ? 'CLOUDY' : 'CLEAR';

  const pm10 = 25 + (day % 10) * 8;
  const pm10Level: DustLevel =
    pm10 < 30 ? 'GOOD' : pm10 < 80 ? 'MODERATE' : pm10 < 150 ? 'BAD' : 'VERY_BAD';

  const wind = Math.round((1.5 + (kstHour % 5) * 0.7 + (condition === 'STORM' ? 12 : 0)) * 10) / 10;
  const humidity = condition === 'RAIN' ? 80 : 50 + (kstHour % 6) * 5;
  const feelsLike = Math.round((temp + (humidity > 70 ? 1.5 : 0) - (wind > 4 ? 1 : 0)) * 10) / 10;

  let hazardLevel: HazardLevel = 'NONE';
  let hazardReason: string | null = null;
  let workAdvice = '정상 작업 가능';

  if (feelsLike >= 33) {
    hazardLevel = 'DANGER';
    hazardReason = '폭염경보 (체감 33°C↑)';
    workAdvice = '옥외 작업 1시간 내 휴식 의무 · 식염수 비치';
  } else if (feelsLike >= 31) {
    hazardLevel = 'WARN';
    hazardReason = '폭염주의보 (체감 31°C↑)';
    workAdvice = '음수 자주 섭취 · 그늘 쉼터 확인';
  }
  if (temp <= -10 && hazardLevel === 'NONE') {
    hazardLevel = 'WARN';
    hazardReason = '한파주의보';
    workAdvice = '방한복 착용 점검 · 작업 단축 검토';
  }
  if (pm10 >= 150) {
    hazardLevel = 'DANGER';
    hazardReason = '미세먼지 매우 나쁨';
    workAdvice = '마스크 필수 · 실외 작업 단축 검토';
  } else if (pm10 >= 80 && hazardLevel !== 'DANGER') {
    if (hazardLevel === 'NONE') hazardLevel = 'WARN';
    hazardReason = (hazardReason ?? '') + (hazardReason ? ' / ' : '') + '미세먼지 나쁨';
    workAdvice = '마스크 착용 권장';
  }
  if (wind >= 14) {
    hazardLevel = 'DANGER';
    hazardReason = (hazardReason ?? '') + (hazardReason ? ' / ' : '') + '강풍경보';
    workAdvice = '고소·차량 작업 일시 중단';
  } else if (wind >= 10 && hazardLevel === 'NONE') {
    hazardLevel = 'CAUTION';
    hazardReason = '강풍주의';
  }
  if (condition === 'RAIN' && hazardLevel === 'NONE') {
    hazardLevel = 'CAUTION';
    hazardReason = '강우';
    workAdvice = '미끄럼 주의 · 우비 착용';
  }

  return {
    region: '서울특별시 강남구',
    observedAt: now.toISOString(),
    temp,
    feelsLike,
    condition,
    conditionLabel: CONDITION_LABEL[condition],
    humidity,
    windSpeed: wind,
    pm10,
    pm10Level,
    pm10Label: DUST_LABEL[pm10Level],
    hazardLevel,
    hazardLabel: HAZARD_LABEL[hazardLevel],
    hazardReason,
    workAdvice,
  };
}
