'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type DayRecord = {
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  feelsLikeMax: number | null;
  precip: number | null;
  hazard: 'HIGH_RISK' | 'HEAT_WAVE' | 'NORMAL' | 'COLD' | null;
};

type TemperatureData = {
  yearMonth: string;
  location: { lat: number; lng: number };
  summary: {
    totalDays: number;
    dataAvailableDays: number;
    heatWaveDays: number;
    highRiskDays: number;
    coldDays: number;
    maxTempHigh: number | null;
    maxTempLow: number | null;
    minTempLow: number | null;
  };
  days: DayRecord[];
};

const HAZARD_LABEL: Record<string, string> = {
  HIGH_RISK: '고위험',
  HEAT_WAVE: '폭염',
  NORMAL: '정상',
  COLD: '한파',
};
const HAZARD_BG: Record<string, string> = {
  HIGH_RISK: 'bg-red-100 text-red-700 font-extrabold',
  HEAT_WAVE: 'bg-orange-100 text-orange-700 font-bold',
  NORMAL: '',
  COLD: 'bg-sky-100 text-sky-700 font-bold',
};
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function TemperatureClient({ initialYearMonth }: { initialYearMonth: string }) {
  const router = useRouter();
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [data, setData] = useState<TemperatureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(ym: string) {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/safety/weather/daily?yearMonth=${ym}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.message ?? d.error);
        setData(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(initialYearMonth); }, []);

  function navigate() {
    router.push(`/safety/temperature?yearMonth=${yearMonth}`);
    load(yearMonth);
  }

  const [y, m] = (data?.yearMonth ?? yearMonth).split('-');

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <a href="/safety" className="text-sm font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-white">
          ← 안전관리
        </a>
        <h2 className="text-xl font-black text-ink tracking-tight">사업장 일자별 온도조회</h2>
      </div>

      {/* 컨트롤 */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-sm font-mono font-extrabold text-ink-faint mb-1">조회 년월</div>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold"
          />
        </div>
        <button
          onClick={navigate}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong"
        >
          조회
        </button>
        {data && (
          <div className="ml-auto flex gap-2">
            <a
              href={`/api/safety/weather/daily/export?yearMonth=${data.yearMonth}`}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-green-700 text-white hover:bg-green-800"
            >
              📥 Excel
            </a>
            <button
              onClick={() => window.print()}
              className="px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              🖨 인쇄
            </button>
          </div>
        )}
        {data && (
          <span className="text-sm text-ink-muted self-center">
            위치: {data.location.lat.toFixed(4)}, {data.location.lng.toFixed(4)}
          </span>
        )}
      </div>

      {loading && <div className="py-10 text-center text-ink-faint text-sm">Open-Meteo API 조회 중…</div>}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
          <strong>API 오류:</strong> {error}
          <div className="text-sm mt-1 text-red-500">WEATHER_LAT / WEATHER_LNG 환경변수를 확인하거나 잠시 후 재시도 하세요.</div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">

          {/* 출력 타이틀 */}
          <div className="hidden print:block text-center border-t-4 border-double border-slate-700 pt-3 mb-4">
            <h1 className="text-2xl font-black">사업장 일자별 온도 기록부</h1>
            <div className="text-sm font-bold text-ink-faint mt-1">{y}년 {m}월</div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="전체 일수"
              value={`${data.summary.totalDays}일`}
              sub={`데이터 ${data.summary.dataAvailableDays}일`}
            />
            <SummaryCard
              label="폭염 작업일 (31℃↑)"
              value={`${data.summary.heatWaveDays}일`}
              tone="warn"
            />
            <SummaryCard
              label="고위험일 (33℃↑)"
              value={`${data.summary.highRiskDays}일`}
              tone="danger"
            />
            <SummaryCard
              label="최고 / 최저"
              value={data.summary.maxTempHigh !== null ? `${data.summary.maxTempHigh}℃` : '—'}
              sub={data.summary.minTempLow !== null ? `최저 ${data.summary.minTempLow}℃` : undefined}
            />
          </div>

          {/* 출력용 요약표 */}
          <div className="hidden print:grid grid-cols-3 gap-4 border border-slate-700 p-3 mb-2 text-sm">
            <div><span className="font-bold">전체일수:</span> {data.summary.totalDays}일</div>
            <div><span className="font-bold text-orange-700">폭염작업일수(31℃↑):</span> {data.summary.heatWaveDays}일</div>
            <div><span className="font-bold text-red-700">고위험일수(33℃↑):</span> {data.summary.highRiskDays}일</div>
          </div>

          {/* 일자별 테이블 */}
          <div className="bg-white border border-line rounded-xl overflow-hidden print:border-2 print:border-slate-700">
            <div className="px-4 py-2 bg-slate-50 border-b border-line print:bg-slate-100">
              <span className="text-sm font-extrabold text-ink-faint">
                {y}년 {m}월 일자별 온도 (출처: Open-Meteo · 체감온도 기준 위험도 판정)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-line">
                  <tr>
                    <th className="px-3 py-2 text-left font-extrabold text-sm w-24">날짜</th>
                    <th className="px-3 py-2 text-left font-extrabold text-sm w-10">요일</th>
                    <th className="px-3 py-2 text-right font-extrabold text-sm">최고(℃)</th>
                    <th className="px-3 py-2 text-right font-extrabold text-sm">최저(℃)</th>
                    <th className="px-3 py-2 text-right font-extrabold text-sm hidden sm:table-cell">체감최고(℃)</th>
                    <th className="px-3 py-2 text-right font-extrabold text-sm hidden md:table-cell">강수(mm)</th>
                    <th className="px-3 py-2 text-center font-extrabold text-sm">위험도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.days.map((day) => {
                    const dt = new Date(day.date + 'T00:00:00+09:00');
                    const dow = DOW_KR[dt.getDay()];
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    const noData = day.maxTemp === null;
                    const today = new Date().toISOString().slice(0, 10);
                    const isFuture = day.date > today;
                    const rowBg = noData ? 'bg-slate-50' : (HAZARD_BG[day.hazard ?? 'NORMAL'] ?? '');

                    return (
                      <tr key={day.date} className={`${rowBg} hover:bg-surface-soft transition`}>
                        <td className={`px-3 py-1.5 font-mono text-sm ${isWeekend ? 'text-rose-600 font-bold' : ''}`}>
                          {day.date.slice(5)}
                        </td>
                        <td className={`px-3 py-1.5 text-sm font-bold text-center ${isWeekend ? 'text-rose-500' : 'text-ink-muted'}`}>
                          {dow}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-sm">
                          {day.maxTemp !== null ? `${day.maxTemp}` : <span className="text-slate-300 text-sm">{isFuture ? '—' : '⋯'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-sm text-ink-muted">
                          {day.minTemp !== null ? `${day.minTemp}` : <span className="text-slate-300 text-sm">{isFuture ? '—' : '⋯'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-sm hidden sm:table-cell">
                          {day.feelsLikeMax !== null ? (
                            <span className={day.feelsLikeMax >= 33 ? 'text-red-600 font-extrabold' : day.feelsLikeMax >= 31 ? 'text-orange-600 font-bold' : ''}>
                              {day.feelsLikeMax}
                            </span>
                          ) : <span className="text-slate-300 text-sm">{isFuture ? '—' : '⋯'}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-sm text-ink-muted hidden md:table-cell">
                          {day.precip !== null ? (day.precip > 0 ? `${day.precip}` : '0') : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {isFuture ? (
                            <span className="text-sm text-slate-300">미래</span>
                          ) : day.hazard && day.hazard !== 'NORMAL' ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-sm font-extrabold ${
                              day.hazard === 'HIGH_RISK' ? 'bg-red-500 text-white' :
                              day.hazard === 'HEAT_WAVE' ? 'bg-orange-400 text-white' :
                              'bg-sky-500 text-white'
                            }`}>
                              {HAZARD_LABEL[day.hazard]}
                            </span>
                          ) : noData ? (
                            <span className="text-sm text-slate-300">데이터없음</span>
                          ) : (
                            <span className="text-sm text-ink-faint">정상</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex gap-4 text-sm text-ink-muted print:hidden">
            <span><span className="inline-block w-3 h-3 rounded bg-red-500 mr-1"></span>고위험(체감 33℃↑)</span>
            <span><span className="inline-block w-3 h-3 rounded bg-orange-400 mr-1"></span>폭염(체감 31℃↑)</span>
            <span><span className="inline-block w-3 h-3 rounded bg-sky-500 mr-1"></span>한파(최고 -10℃↓)</span>
            <span className="ml-auto">⋯ = 데이터 준비 중 (Archive 약 5일 지연)</span>
          </div>

          <div className="mt-2 text-center text-sm font-mono text-ink-faint print:block hidden">
            출력일시: {new Date().toLocaleString('ko-KR')} · 데이터 출처: Open-Meteo (archive-api.open-meteo.com)
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:grid { display: grid !important; }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone?: 'warn' | 'danger' | 'default';
}) {
  const colors =
    tone === 'danger' ? 'border-red-300 bg-red-50' :
    tone === 'warn' ? 'border-orange-300 bg-orange-50' :
    'border-line bg-surface';
  const valueColor =
    tone === 'danger' ? 'text-red-700' :
    tone === 'warn' ? 'text-orange-700' :
    'text-ink';
  return (
    <div className={`border rounded-xl p-4 text-center print:border-slate-700 ${colors}`}>
      <div className="text-sm font-mono font-extrabold text-ink-faint mb-1">{label}</div>
      <div className={`text-2xl font-black ${valueColor}`}>{value}</div>
      {sub && <div className="text-sm text-ink-faint mt-0.5">{sub}</div>}
    </div>
  );
}
