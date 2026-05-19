/**
 * GET /api/safety/weather/daily/export?yearMonth=YYYY-MM
 * 사업장 일자별 온도 기록부 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { fetchJson } from '@/lib/fetch-ipv4';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

type DayRecord = {
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  feelsLikeMax: number | null;
  precip: number | null;
  humidityMax: number | null;
  windSpeedAvg: number | null;
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
  85: '소설', 86: '강한소설',
  95: '뇌우', 96: '우박뇌우', 99: '강한우박뇌우',
};

function skyLabel(code: number | null): string {
  if (code === null) return '';
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

function parseResponse(data: {
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
    const HAZARD_LABEL: Record<string, string> = {
      HIGH_RISK: '고위험(33℃↑)', HEAT_WAVE: '폭염(31℃↑)', NORMAL: '정상', COLD: '한파',
    };
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
      hazardLabel: hazard ? (HAZARD_LABEL[hazard] ?? null) : null,
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

  const archiveCutoff = new Date(today);
  archiveCutoff.setDate(archiveCutoff.getDate() - 7);
  const archiveCutoffStr = archiveCutoff.toISOString().slice(0, 10);

  const effectiveEnd = endDate > todayStr ? todayStr : endDate;

  if (effectiveEnd <= archiveCutoffStr) {
    const data = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${effectiveEnd}`);
    return parseResponse(data as Parameters<typeof parseResponse>[0]);
  }

  if (startDate >= archiveCutoffStr) {
    const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${base}&start_date=${startDate}&end_date=${effectiveEnd}`);
    return parseResponse(data as Parameters<typeof parseResponse>[0]);
  }

  const [archiveData, forecastData] = await Promise.all([
    fetchJson(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${startDate}&end_date=${archiveCutoffStr}`),
    fetchJson(`https://api.open-meteo.com/v1/forecast?${base}&start_date=${archiveCutoffStr}&end_date=${effectiveEnd}`),
  ]);
  const merged = parseResponse(archiveData as Parameters<typeof parseResponse>[0]);
  for (const [k, v] of parseResponse(forecastData as Parameters<typeof parseResponse>[0])) merged.set(k, v);
  return merged;
}

function hazardToAction(hazard: DayRecord['hazard']): {
  legalBasis: string; actionType: string; actionContent: string;
} {
  switch (hazard) {
    case 'HIGH_RISK':
      return {
        legalBasis: '산안법 제559조 (폭염특보 시 작업중지)',
        actionType: '작업중지/단축',
        actionContent: '옥외 고위험작업 중지, 서늘한 곳 대피 및 충분한 수분 보충',
      };
    case 'HEAT_WAVE':
      return {
        legalBasis: '산안법 제559조 (폭염작업 보건관리)',
        actionType: '작업시간 조정/휴식',
        actionContent: '매 시간 10~15분 이상 그늘 휴식, 냉수 및 이온음료 제공',
      };
    case 'COLD':
      return {
        legalBasis: '산안법 제560조 (한랭작업 보호조치)',
        actionType: '방한조치/작업시간 단축',
        actionContent: '방한복·방한화 착용, 주기적 워밍업, 작업시간 단축',
      };
    default:
      return { legalBasis: '', actionType: '', actionContent: '' };
  }
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

    const today = new Date().toISOString().slice(0, 10);
    const days: DayRecord[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      if (dateStr > today) {
        days.push({ date: dateStr, maxTemp: null, minTemp: null, feelsLikeMax: null, precip: null, humidityMax: null, windSpeedAvg: null, weatherCode: null, skyLabel: null, hazard: null, hazardLabel: null });
      } else {
        days.push(weatherMap.get(dateStr) ?? { date: dateStr, maxTemp: null, minTemp: null, feelsLikeMax: null, precip: null, humidityMax: null, windSpeedAvg: null, weatherCode: null, skyLabel: null, hazard: null, hazardLabel: null });
      }
    }

    const dataRows = days.filter((d) => d.maxTemp !== null);
    const heatWaveDays = dataRows.filter((d) => d.hazard === 'HEAT_WAVE' || d.hazard === 'HIGH_RISK').length;
    const highRiskDays = dataRows.filter((d) => d.hazard === 'HIGH_RISK').length;
    const coldDays = dataRows.filter((d) => d.hazard === 'COLD').length;

    // Build Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WCI-ERP';
    wb.created = new Date();

    const ws = wb.addWorksheet('일자별온도');

    // ─── Title ───
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '사업장 일자별 온도 기록부';
    titleCell.font = { name: '맑은 고딕', bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    // ─── Period ───
    ws.mergeCells('A2:K2');
    const periodCell = ws.getCell('A2');
    periodCell.value = `조회기간: ${y}년 ${m}월 (${startDate} ~ ${endDate})`;
    periodCell.font = { name: '맑은 고딕', size: 10 };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    // ─── Summary ───
    ws.mergeCells('A3:K3');
    const sumCell = ws.getCell('A3');
    sumCell.value = `전체일수: ${lastDay}일  |  데이터: ${dataRows.length}일  |  폭염작업일수(31℃↑): ${heatWaveDays}일  |  고위험일수(33℃↑): ${highRiskDays}일  |  한파일수: ${coldDays}일`;
    sumCell.font = { name: '맑은 고딕', size: 9, italic: true };
    sumCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 18;

    ws.addRow([]); // spacer row 4

    // ─── Header row ───
    const headers = [
      '날짜', '최고체감온도(℃)', '최고기온(℃)', '최저기온(℃)',
      '최고습도(%)', '평균풍속(m/s)', '하늘상태', '폭염등급',
      '법적 조치기준', '조치구분', '조치내용',
    ];
    const headerRow = ws.addRow(headers); // row 5
    headerRow.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5DA8' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    ws.getRow(5).height = 32;

    const DOW_KR = ['(일)', '(월)', '(화)', '(수)', '(목)', '(금)', '(토)'];

    // ─── Data rows ───
    for (const day of days) {
      const dt = new Date(day.date + 'T00:00:00+09:00');
      const dow = DOW_KR[dt.getDay()];
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      const action = hazardToAction(day.hazard);

      const row = ws.addRow([
        `${day.date.slice(5)} ${dow}`,
        day.feelsLikeMax ?? '',
        day.maxTemp ?? '',
        day.minTemp ?? '',
        day.humidityMax ?? '',
        day.windSpeedAvg ?? '',
        day.skyLabel ?? '',
        day.hazard && day.hazard !== 'NORMAL' ? (day.hazardLabel ?? '') : '',
        action.legalBasis,
        action.actionType,
        action.actionContent,
      ]);

      // Row styling
      const hazardBg: Record<string, string> = {
        HIGH_RISK: 'FFFCE4EC',
        HEAT_WAVE: 'FFFFF3E0',
        COLD: 'FFE3F2FD',
      };
      const bgColor = day.hazard && day.hazard !== 'NORMAL' ? (hazardBg[day.hazard] ?? 'FFFFFFFF') : 'FFFFFFFF';

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
        cell.font = { name: '맑은 고딕', size: 10 };
        if (colNum <= 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (isWeekend) cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FFCC0000' } };
        } else if (colNum <= 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        if (colNum === 8 && day.hazard === 'HIGH_RISK') {
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFCC0000' } };
        } else if (colNum === 8 && day.hazard === 'HEAT_WAVE') {
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFE65100' } };
        }
      });
      row.height = 20;
    }

    // ─── Column widths ───
    ws.columns = [
      { width: 14 }, // 날짜
      { width: 14 }, // 최고체감온도
      { width: 12 }, // 최고기온
      { width: 12 }, // 최저기온
      { width: 12 }, // 최고습도
      { width: 14 }, // 평균풍속
      { width: 14 }, // 하늘상태
      { width: 16 }, // 폭염등급
      { width: 36 }, // 법적조치기준
      { width: 20 }, // 조치구분
      { width: 42 }, // 조치내용
    ];

    // ─── Source note ───
    const noteRowIdx = 5 + days.length + 1;
    ws.mergeCells(`A${noteRowIdx}:K${noteRowIdx}`);
    const noteCell = ws.getCell(`A${noteRowIdx}`);
    noteCell.value = `데이터 출처: Open-Meteo (archive-api.open-meteo.com / api.open-meteo.com)  |  출력일시: ${new Date().toLocaleString('ko-KR')}`;
    noteCell.font = { name: '맑은 고딕', size: 8, color: { argb: 'FF888888' } };
    noteCell.alignment = { horizontal: 'center' };

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `사업장일자별온도_${yearMonth.replace('-', '')}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    console.error('[weather/daily/export]', e);
    return NextResponse.json(
      { error: 'export_failed', message: e instanceof Error ? e.message : 'Excel 생성 실패' },
      { status: 502 }
    );
  }
}
