/**
 * Weather Provider 추상화 + in-memory 5분 캐시
 *  - mock        (default) — deterministic 시뮬레이션
 *  - openweather — OpenWeather Current Weather API (영문 무료 키)
 *  - kma         — 기상청 단기실황 (Korean grid X/Y 변환 필요)
 *
 * 환경변수:
 *  WEATHER_PROVIDER=mock|openweather|kma
 *  OPENWEATHER_API_KEY=...
 *  KMA_API_KEY=...
 *  WEATHER_LAT=37.4979
 *  WEATHER_LNG=127.0276
 *  WEATHER_REGION=서울특별시 강남구
 */
import { getCurrentWeather as getMockWeather, type WeatherSnapshot, type WeatherCondition, type DustLevel, type HazardLevel } from './weather';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { ts: number; data: WeatherSnapshot }>();

const HAZARD_LABEL: Record<HazardLevel, string> = {
  NONE: '정상', CAUTION: '주의', WARN: '경보', DANGER: '위험',
};
const DUST_LABEL: Record<DustLevel, string> = {
  GOOD: '좋음', MODERATE: '보통', BAD: '나쁨', VERY_BAD: '매우 나쁨',
};
const CONDITION_LABEL: Record<WeatherCondition, string> = {
  CLEAR: '맑음', CLOUDY: '흐림', RAIN: '비', SNOW: '눈', STORM: '폭풍',
};

function classifyDust(pm10: number): DustLevel {
  if (pm10 < 30) return 'GOOD';
  if (pm10 < 80) return 'MODERATE';
  if (pm10 < 150) return 'BAD';
  return 'VERY_BAD';
}

function evaluateHazard(temp: number, feelsLike: number, pm10: number, wind: number, condition: WeatherCondition):
  { level: HazardLevel; reason: string | null; advice: string } {
  let level: HazardLevel = 'NONE';
  const reasons: string[] = [];
  let advice = '정상 작업 가능';

  if (feelsLike >= 33) { level = 'DANGER'; reasons.push('폭염경보 (체감 33°C↑)'); advice = '옥외 작업 1시간 내 휴식 의무 · 식염수 비치'; }
  else if (feelsLike >= 31) { level = 'WARN'; reasons.push('폭염주의보 (체감 31°C↑)'); advice = '음수 자주 섭취 · 그늘 쉼터 확인'; }
  if (temp <= -10 && level === 'NONE') { level = 'WARN'; reasons.push('한파주의보'); advice = '방한복 착용 점검 · 작업 단축 검토'; }
  if (pm10 >= 150) { level = 'DANGER'; reasons.push('미세먼지 매우 나쁨'); advice = '마스크 필수 · 실외 작업 단축 검토'; }
  else if (pm10 >= 80 && level !== 'DANGER') {
    if (level === 'NONE') level = 'WARN';
    reasons.push('미세먼지 나쁨');
    advice = '마스크 착용 권장';
  }
  if (wind >= 14) { level = 'DANGER'; reasons.push('강풍경보'); advice = '고소·차량 작업 일시 중단'; }
  else if (wind >= 10 && level === 'NONE') { level = 'CAUTION'; reasons.push('강풍주의'); }
  if (condition === 'RAIN' && level === 'NONE') { level = 'CAUTION'; reasons.push('강우'); advice = '미끄럼 주의 · 우비 착용'; }

  return { level, reason: reasons.length ? reasons.join(' / ') : null, advice };
}

function mapOpenWeatherCondition(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return 'STORM';
  if (id >= 300 && id < 600) return 'RAIN';
  if (id >= 600 && id < 700) return 'SNOW';
  if (id >= 700 && id < 800) return 'CLOUDY';
  if (id === 800) return 'CLEAR';
  if (id > 800) return 'CLOUDY';
  return 'CLEAR';
}

async function fetchOpenWeather(overrideLat?: number, overrideLng?: number): Promise<WeatherSnapshot> {
  const apiKey = process.env.OPENWEATHER_API_KEY!;
  const lat = overrideLat ?? Number(process.env.WEATHER_LAT ?? 37.4979);
  const lng = overrideLng ?? Number(process.env.WEATHER_LNG ?? 127.0276);
  const region = process.env.WEATHER_REGION ?? '서울특별시 강남구';

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=kr`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`openweather ${res.status}`);
  const j = (await res.json()) as {
    main: { temp: number; feels_like: number; humidity: number };
    wind: { speed: number };
    weather: Array<{ id: number }>;
  };

  const temp = Math.round(j.main.temp * 10) / 10;
  const feelsLike = Math.round(j.main.feels_like * 10) / 10;
  const wind = Math.round(j.wind.speed * 10) / 10;
  const humidity = Math.round(j.main.humidity);
  const condition = mapOpenWeatherCondition(j.weather?.[0]?.id ?? 800);

  /* OpenWeather에 pm10 없음 — 별도 호출 필요. 시안: 시간 기반 추정 */
  const pm10 = 25 + (new Date().getUTCDate() % 10) * 8;
  const pm10Level = classifyDust(pm10);
  const hz = evaluateHazard(temp, feelsLike, pm10, wind, condition);

  return {
    region,
    observedAt: new Date().toISOString(),
    temp, feelsLike,
    condition,
    conditionLabel: CONDITION_LABEL[condition],
    humidity,
    windSpeed: wind,
    pm10,
    pm10Level,
    pm10Label: DUST_LABEL[pm10Level],
    hazardLevel: hz.level,
    hazardLabel: HAZARD_LABEL[hz.level],
    hazardReason: hz.reason,
    workAdvice: hz.advice,
  };
}

/**
 * Open-Meteo (https://open-meteo.com)
 *  - 무료 + API 키 불필요 (10,000 req/day 제한)
 *  - 한국 좌표 정확 지원
 *  - WMO weather code 변환 필요
 *  - 별도 air-quality endpoint로 PM10 조회
 */
function mapWmoCode(code: number): WeatherCondition {
  if (code === 0) return 'CLEAR';
  if (code >= 1 && code <= 3) return 'CLOUDY';
  if (code >= 45 && code <= 48) return 'CLOUDY';      // 안개
  if (code >= 51 && code <= 67) return 'RAIN';        // 이슬비/비
  if (code >= 71 && code <= 77) return 'SNOW';        // 눈
  if (code >= 80 && code <= 82) return 'RAIN';        // 소나기
  if (code >= 85 && code <= 86) return 'SNOW';        // 눈 소나기
  if (code >= 95) return 'STORM';                     // 뇌우
  return 'CLOUDY';
}

async function fetchOpenMeteo(overrideLat?: number, overrideLng?: number): Promise<WeatherSnapshot> {
  const lat = overrideLat ?? Number(process.env.WEATHER_LAT ?? 37.4979);
  const lng = overrideLng ?? Number(process.env.WEATHER_LNG ?? 127.0276);
  const region = process.env.WEATHER_REGION ?? '서울특별시 강남구';

  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&timezone=Asia%2FSeoul`;
  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=pm10&timezone=Asia%2FSeoul`;

  const [wxRes, aqRes] = await Promise.all([
    fetch(wxUrl, { signal: AbortSignal.timeout(8000) }),
    fetch(aqUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null),
  ]);
  if (!wxRes.ok) throw new Error(`open-meteo wx ${wxRes.status}`);
  type WxResp = {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;       // km/h
    };
  };
  type AqResp = { current?: { pm10?: number } };
  const wx = (await wxRes.json()) as WxResp;
  const aq = aqRes && aqRes.ok ? ((await aqRes.json()) as AqResp) : null;

  const c = wx.current;
  const temp = Math.round(c.temperature_2m * 10) / 10;
  const feelsLike = Math.round(c.apparent_temperature * 10) / 10;
  /* Open-Meteo wind은 km/h — m/s 변환 */
  const wind = Math.round((c.wind_speed_10m / 3.6) * 10) / 10;
  const humidity = Math.round(c.relative_humidity_2m);
  const condition = mapWmoCode(c.weather_code);
  const pm10 = Math.round(aq?.current?.pm10 ?? 30);
  const pm10Level = classifyDust(pm10);
  const hz = evaluateHazard(temp, feelsLike, pm10, wind, condition);

  return {
    region,
    observedAt: new Date().toISOString(),
    temp, feelsLike,
    condition,
    conditionLabel: CONDITION_LABEL[condition],
    humidity,
    windSpeed: wind,
    pm10,
    pm10Level,
    pm10Label: DUST_LABEL[pm10Level],
    hazardLevel: hz.level,
    hazardLabel: HAZARD_LABEL[hz.level],
    hazardReason: hz.reason,
    workAdvice: hz.advice,
  };
}

/**
 * KMA 단기실황 (기상청 공공데이터)
 *  - 엔드포인트: getUltraSrtNcst (초단기실황)
 *  - 발표시각: 매시 정각(HH:00) 데이터가 HH:40부터 조회 가능
 *  - 좌표: 격자 X/Y (위경도→격자 변환은 정식 공식 必, 시안은 강남구 nx=61 ny=126 기본)
 *  - 키: data.go.kr → "기상청_단기예보 ((구) 동네예보) 조회서비스" 신청
 *
 * 카테고리 (관심 항목):
 *   T1H 기온(°C), REH 습도(%), WSD 풍속(m/s), RN1 1시간강수량(mm)
 *   PTY 강수형태 (0=없음 1=비 2=비/눈 3=눈 5=빗방울 6=빗방울/눈날림 7=눈날림)
 */
function kmaBaseTimeKst(now: Date): { baseDate: string; baseTime: string } {
  /* 발표시각 = HH:00, HH:40 이후 조회 가능. HH:00~HH:39이면 직전 시각 사용. */
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  let h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  if (m < 40) {
    h = h - 1;
    if (h < 0) {
      h = 23;
      kst.setUTCDate(kst.getUTCDate() - 1);
    }
  }
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(h).padStart(2, '0');
  return { baseDate: `${y}${mo}${d}`, baseTime: `${hh}00` };
}

type KmaEndpoint = 'apihub' | 'datago';

function detectKmaEndpoint(): KmaEndpoint {
  const explicit = (process.env.KMA_ENDPOINT ?? '').toLowerCase();
  if (explicit === 'apihub' || explicit === 'datago') return explicit as KmaEndpoint;
  /* 키 길이로 자동 판별: APIHub (~22자) vs data.go.kr (~80~150자) */
  const k = process.env.KMA_API_KEY ?? '';
  return k.length <= 50 ? 'apihub' : 'datago';
}

type KmaItem = { category: string; obsrValue: string };
type KmaResp = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KmaItem[] } };
  };
};

async function fetchKmaItems(
  endpoint: KmaEndpoint,
  apiKey: string,
  baseDate: string,
  baseTime: string,
  nx: string,
  ny: string
): Promise<KmaItem[]> {
  const base =
    endpoint === 'apihub'
      ? 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst'
      : 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';
  const authParam = endpoint === 'apihub' ? 'authKey' : 'serviceKey';
  const url =
    `${base}?${authParam}=${encodeURIComponent(apiKey)}` +
    `&numOfRows=10&pageNo=1&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`kma ${endpoint} http ${res.status}`);
  const j = (await res.json()) as KmaResp;
  const code = j?.response?.header?.resultCode;
  if (code && code !== '00') {
    throw new Error(`kma ${endpoint} resultCode=${code} msg=${j.response?.header?.resultMsg ?? '?'}`);
  }
  const items = j?.response?.body?.items?.item ?? [];
  if (items.length === 0) throw new Error(`kma ${endpoint} empty items`);
  return items;
}

async function fetchKma(_overrideLat?: number, _overrideLng?: number): Promise<WeatherSnapshot> {
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) throw new Error('KMA_API_KEY not set');
  const nx = process.env.KMA_GRID_NX ?? '61';
  const ny = process.env.KMA_GRID_NY ?? '126';

  const now = new Date();
  const { baseDate, baseTime } = kmaBaseTimeKst(now);

  /* 1순위 endpoint 시도, 실패 시 다른 endpoint로 한 번 더 */
  const primary = detectKmaEndpoint();
  const secondary: KmaEndpoint = primary === 'apihub' ? 'datago' : 'apihub';

  let items: KmaItem[];
  try {
    items = await fetchKmaItems(primary, apiKey, baseDate, baseTime, nx, ny);
  } catch (e1) {
    try {
      items = await fetchKmaItems(secondary, apiKey, baseDate, baseTime, nx, ny);
      console.warn(`[kma] primary(${primary}) failed, fallback(${secondary}) succeeded:`, e1);
    } catch (e2) {
      throw new Error(`kma both endpoints failed: ${(e1 as Error).message} | ${(e2 as Error).message}`);
    }
  }

  const map: Record<string, number> = {};
  for (const it of items) map[it.category] = Number(it.obsrValue);

  const temp = map.T1H ?? 15;
  const humidity = map.REH ?? 50;
  const wind = map.WSD ?? 1;
  const rain1h = map.RN1 ?? 0;
  const ptyCode = map.PTY ?? 0;
  const condition: WeatherCondition =
    ptyCode === 1 || ptyCode === 5 ? 'RAIN' :
    ptyCode === 2 ? 'RAIN' :
    ptyCode === 3 || ptyCode === 7 ? 'SNOW' :
    ptyCode === 6 ? 'SNOW' :
    rain1h > 0 ? 'RAIN' :
    'CLEAR';
  const feelsLike = temp - (wind > 4 ? 1 : 0);

  /* PM10은 별도 endpoint (한국환경공단 ARPLTNINFOINQKNSVC) — 시안 단계 추정값 */
  const pm10 = 30 + (now.getUTCDate() % 8) * 6;
  const pm10Level = classifyDust(pm10);
  const hz = evaluateHazard(temp, feelsLike, pm10, wind, condition);

  return {
    region: process.env.WEATHER_REGION ?? '서울특별시 강남구',
    observedAt: now.toISOString(),
    temp: Math.round(temp * 10) / 10,
    feelsLike: Math.round(feelsLike * 10) / 10,
    condition,
    conditionLabel: CONDITION_LABEL[condition],
    humidity: Math.round(humidity),
    windSpeed: Math.round(wind * 10) / 10,
    pm10,
    pm10Level,
    pm10Label: DUST_LABEL[pm10Level],
    hazardLevel: hz.level,
    hazardLabel: HAZARD_LABEL[hz.level],
    hazardReason: hz.reason,
    workAdvice: hz.advice,
  };
}

/** Provider 선택 + 5분 캐시 + 폴백 */
export type WeatherLocation = {
  lat?: number;
  lng?: number;
  region?: string;
};

export async function fetchWeatherCached(location?: WeatherLocation): Promise<WeatherSnapshot & { provider: string; cacheHit: boolean }> {
  const provider = (process.env.WEATHER_PROVIDER ?? 'mock').toLowerCase();
  /* 위치가 주어진 경우 캐시 키를 위치 기반으로 분리 (1km 격자 반올림) */
  const locKey = location?.lat != null && location?.lng != null
    ? `${Math.round(location.lat * 10) / 10},${Math.round(location.lng * 10) / 10}`
    : 'default';
  const cacheKey = `${provider}:${locKey}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { ...cached.data, provider, cacheHit: true };
  }

  let data: WeatherSnapshot;
  let usedProvider = provider;
  try {
    if (provider === 'open-meteo' || provider === 'openmeteo') {
      data = await fetchOpenMeteo(location?.lat, location?.lng);
      usedProvider = 'open-meteo';
    } else if (provider === 'openweather' && process.env.OPENWEATHER_API_KEY) {
      data = await fetchOpenWeather(location?.lat, location?.lng);
    } else if (provider === 'kma' && process.env.KMA_API_KEY) {
      data = await fetchKma(location?.lat, location?.lng);
    } else {
      data = getMockWeather();
      usedProvider = 'mock';
    }
  } catch (e) {
    console.warn('[weather] provider failed, falling back to mock:', e);
    data = getMockWeather();
    usedProvider = `${provider}-fallback`;
  }

  /* 위치 기반 region 레이블 덮어쓰기 */
  if (location?.region) {
    data = { ...data, region: location.region };
  }

  cache.set(cacheKey, { ts: Date.now(), data });
  return { ...data, provider: usedProvider, cacheHit: false };
}
