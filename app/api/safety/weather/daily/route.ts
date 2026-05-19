/**
 * GET /api/safety/weather/daily?yearMonth=YYYY-MM
 *
 * Open-Meteo API 기반 일자별 기온 조회 (관리자 전용)
 *  - 현재 월 또는 최근 3개월: forecast API
 *  - 이전 월: archive API (archive-api.open-meteo.com)
 *
 * 환경변수: WEATHER_LAT, WEATHER_LNG (없으면 서울 기준)
 * 캐시: 완료된 월 = 6h, 당월 = 15분
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { fetchJson } from '@/lib/fetch-ipv4';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

export type DayRecord = {
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  feelsLikeMax: number | null;
  precip: number | null;
  humidityMax: number | null;
  windSpeedAvg: number | null; // m/s (converted from km/h)
  weatherCode: number | null;
  skyLabel: string | null;
  hazard: 'HIGH_RISK' | 'HEAT_WAVE' | 'NORMAL' | 'COLD' | null;
  hazardLabel: string | null;
};

const WMO_SKY: Record<number, string> = {
  0: '맑음', 1: '대체로맑음', 2: '구름많음', 3: '흐림',
  45: '안개', 48: '결빙안개',
  51: '가벼운이슬비', 53: '이슬비', 55: '짙은이슬비',
  56: '얼음이슬비', 57: '짙은얼음이슬비',
  61: '가벼운비', 63: '비', 65: '강한비',
  66: '얼음비', 67: '강한얼음비',
  71: '가벼운눈', 73: '눈', 75: '강한눈',
  77: '싸락눈',
  80: '소나기', 81: '강한소나기', 82: '매우강한소나기',
  85: '소설(snow shower)', 86: '강한소설',
  95: '뇌우', 96: '우박뇌우', 99: '강한우박뇌우',
};

function skyLabel(code: number | null): string | null {
  if (code === null) return null;
  return WMO_SKY[code] ?? `WMO${code}`;
}

function classifyHazard(maxTemp: number | null, feelsLike: number | null): DayRecord['hazard'] {
  const t = feelsLike ?? maxTemp;
  if (t === null) return null;
  if (t >= 33) return 'HIGH_RISK';
  if (t >= 31) return 'HEAT_WAVE';
  if ((maxTemp ?? 0) <= -10) return 'COLD';
  return 'NORMAL';
}

const HAZARD_LABEL_KR: Record<string, string> = {
  HIGH_RISK: '고위험(33℃↑)',
  HEAT_WAVE: '폭염(31℃↑)',
  NORMAL: '정상',
  COLD: '한파',
};

function parseOpenMeteoResponse(data: {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    apparent_temperature_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    relative_humidity_2m_max?: (number | null)[];
    wind_speed_10m_mean?: (number | null)[];
    weather_code?: (number | null)[];
  };
}): Map<string, DayRecord> {
  const result = new Map<string, DayRecord>();
  const times = data.daily?.time ?? [];
  const maxArr = data.daily?.temperature_2m_max ?? [];
  const minArr = data.daily?.temperature_2m_min ?? [];
  const feelsArr = data.daily?.apparent_temperature_max ?? [];
  const precipArr = data.daily?.precipitation_sum ?? [];
  const humidArr = data.daily?.relative_humidity_2m_max ?? [];
  const windArr = data.daily?.wind_speed_10m_mean ?? [];
  const codeArr = data.daily?.weather_code ?? [];

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    const maxTemp = maxArr[i] ?? null;
    const minTemp = minArr[i] ?? null;
    const feelsLike = feelsArr[i] ?? null;
    const precip = precipArr[i] ?? null;
    const humidity = humidArr[i] ?? null;
    const windKmh = windArr[i] ?? null;
    const code = codeArr[i] ?? null;
    const hazard = classifyHazard(maxTemp, feelsLike);
    result.set(date, {
      date,
      maxTemp: maxTemp !== null ? Math.round(maxTemp * 10) / 10 : null,
      minTemp: minTemp !== null ? Math.round(minTemp * 10) / 10 : null,
      feelsLikeMax: feelsLike !== null ? Math.round(feelsLike * 10) / 10 : null,
      precip: precip !== null ? Math.round(precip * 10) / 10 : null,
      humidityMax: humidity !== null ? Math.round(humidity) : null,
      windSpeedAvg: windKmh !== null ? Math.round((windKmh / 3.6) * 10) / 10 : null,
      weatherCode: code,
      skyLabel: skyLabel(code),
      hazard,
      hazardLabel: hazard ? (HAZARD_LABEL_KR[hazard] ?? null) : null,
    });
  }
  return result;
}

async function fetchWeather(startDate: string, endDate: string): Promise<Map<string, DayRecord>> {
  const lat = process.env.WEATHER_LAT ?? '37.5665';
  const lng = process.env.WEATHER_LNG ?? '126.9780';
  const fields = 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,relative_humidity_2m_max,wind_speed_10m_mean,weather_code';
  const base = `latitude=${lat}&longitude=${lng}&daily=${fields}&timezone=Asia%2FSeoul`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // archive API는 보통 5~7일 전까지 제공
  const archiveCutoff = new Date(today);
  archiveCutoff.setDate(archiveCutoff.getDate() - 7);
  const archiveCutoffStr = archiveCutoff.toISOString().slice(0, 10);

  const effectiveEnd = endDate > todayStr ? todayStr : endDate;

  // end가 오늘 이전이면 archive만 사용
  if (effectiveEnd <= archiveCutoffStr) {
    const data = await fetchJson(
      `https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${effectiveEnd}`
    );
    if ((data as { error?: boolean }).error) throw new Error(`Archive API error`);
    return parseOpenMeteoResponse(data as Parameters<typeof parseOpenMeteoResponse>[0]);
  }

  // 최근 데이터: forecast API
  if (startDate >= archiveCutoffStr) {
    const data = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?${base}&start_date=${startDate}&end_date=${effectiveEnd}`
    );
    if ((data as { error?: boolean }).error) throw new Error(`Forecast API error`);
    return parseOpenMeteoResponse(data as Parameters<typeof parseOpenMeteoResponse>[0]);
  }

  // 혼합 구간: archive(오래된 부분) + forecast(최근 부분) 병렬 조회
  const [archiveData, forecastData] = await Promise.all([
    fetchJson(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${archiveCutoffStr}`),
    fetchJson(`https://api.open-meteo.com/v1/forecast?${base}&start_date=${archiveCutoffStr}&end_date=${effectiveEnd}`),
  ]);

  if ((archiveData as { error?: boolean }).error) throw new Error(`Archive API error`);
  if ((forecastData as { error?: boolean }).error) throw new Error(`Forecast API error`);

  const merged = parseOpenMeteoResponse(archiveData as Parameters<typeof parseOpenMeteoResponse>[0]);
  for (const [k, v] of parseOpenMeteoResponse(forecastData as Parameters<typeof parseOpenMeteoResponse>[0])) {
    merged.set(k, v);
  }
  return merged;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const yearMonth = url.searchParams.get('yearMonth') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return NextResponse.json({ error: 'invalid_yearMonth' }, { status: 400 });
  }

  const [y, m] = yearMonth.split('-').map(Number);
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  try {
    const weatherMap = await fetchWeather(startDate, endDate);

    // 월간 모든 날짜 생성 (데이터 없는 날은 null로 표시)
    const days: DayRecord[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const emptyDay: DayRecord = { date: dateStr, maxTemp: null, minTemp: null, feelsLikeMax: null, precip: null, humidityMax: null, windSpeedAvg: null, weatherCode: null, skyLabel: null, hazard: null, hazardLabel: null };
      if (dateStr > today) {
        days.push(emptyDay);
      } else {
        days.push(weatherMap.get(dateStr) ?? emptyDay);
      }
    }

    // 집계
    const dataRows = days.filter((d) => d.maxTemp !== null);
    const heatWaveDays = dataRows.filter((d) => d.hazard === 'HEAT_WAVE' || d.hazard === 'HIGH_RISK').length;
    const highRiskDays = dataRows.filter((d) => d.hazard === 'HIGH_RISK').length;
    const coldDays = dataRows.filter((d) => d.hazard === 'COLD').length;
    const allMaxTemps = dataRows.map((d) => d.maxTemp!);
    const allMinTemps = dataRows.map((d) => d.minTemp!);

    return NextResponse.json({
      yearMonth,
      location: {
        lat: parseFloat(process.env.WEATHER_LAT ?? '37.5665'),
        lng: parseFloat(process.env.WEATHER_LNG ?? '126.9780'),
      },
      summary: {
        totalDays: lastDay,
        dataAvailableDays: dataRows.length,
        heatWaveDays,
        highRiskDays,
        coldDays,
        maxTempHigh: allMaxTemps.length ? Math.max(...allMaxTemps) : null,
        maxTempLow: allMaxTemps.length ? Math.min(...allMaxTemps) : null,
        minTempLow: allMinTemps.length ? Math.min(...allMinTemps) : null,
      },
      days,
    });
  } catch (e) {
    console.error('[weather/daily]', e);
    return NextResponse.json(
      { error: 'fetch_failed', message: e instanceof Error ? e.message : 'API 조회 실패' },
      { status: 502 }
    );
  }
}
