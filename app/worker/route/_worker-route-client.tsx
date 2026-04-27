// 기동반(RAPID) WORKER용 미처리 민원 추천경로 — 모바일 simplified UI
// API 재사용: POST /api/live-tracking/optimize-route (source=complaints 기본값)
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('@/app/(admin)/live-vehicles/_leaflet-map'), {
  ssr: false,
  loading: () => <div className="h-[320px] flex items-center justify-center text-slate-700 font-bold">지도 로드 중…</div>,
});

type Stop = { lat: number; lng: number; label: string };

type RouteResp = {
  stops: Stop[];
  order: number[];
  polyline?: Array<[number, number]>;
  polylineSource?: 'ors' | 'osrm' | 'straight' | null;
  stats: {
    distanceKm: number;
    durationMin: number;
    baselineKm: number;
    savedKm: number;
    savedPct: number;
    algorithm: string;
    iterations: number;
    elapsedMs: number;
  };
  startLabel: string;
};

export default function WorkerRouteClient({ positionLabel }: { positionLabel: string }) {
  const [data, setData] = useState<RouteResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxStops, setMaxStops] = useState(15);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/live-tracking/optimize-route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'complaints', maxStops }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = await r.json();
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 헤더 */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚀</span>
          <h2 className="text-base font-black text-purple-900">기동반 추천경로</h2>
        </div>
        <p className="text-[11px] font-bold text-purple-800 leading-snug">
          미처리 민원 위치를 모아 최단 순회 경로를 계산합니다 · 직책: <span className="font-mono">{positionLabel}</span>
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="bg-surface border-2 border-line rounded-lg p-3 space-y-3">
        <div>
          <label htmlFor="max-stops" className="block text-[10px] font-mono font-extrabold text-slate-700 mb-1">
            최대 순회 지점 (2~30)
          </label>
          <input
            id="max-stops"
            type="number"
            min={2}
            max={30}
            value={maxStops}
            onChange={(e) => setMaxStops(Math.max(2, Math.min(30, Number(e.target.value) || 15)))}
            className="w-full px-3 py-2.5 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent min-h-[44px]"
          />
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="w-full px-4 py-3 rounded-md bg-emerald-700 text-white text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-50 active:scale-95 min-h-[48px]"
        >
          {busy ? '경로 계산 중…' : '🚀 미처리 민원으로 경로 최적화'}
        </button>
      </div>

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-3 py-3 text-sm font-bold text-red-800">
          오류: {error}
        </div>
      )}

      {/* 결과 통계 */}
      {data && (
        <div className="bg-cyan-50 border-2 border-accent rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-white rounded p-2">
              <div className="text-[10px] font-mono font-extrabold text-slate-700">총 거리</div>
              <div className="text-lg font-mono font-black text-accent">{data.stats.distanceKm} km</div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-[10px] font-mono font-extrabold text-slate-700">예상 시간</div>
              <div className="text-lg font-mono font-black text-accent">{data.stats.durationMin} 분</div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-[10px] font-mono font-extrabold text-slate-700">절감 거리</div>
              <div className="text-lg font-mono font-black text-emerald-700">{data.stats.savedKm} km</div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-[10px] font-mono font-extrabold text-slate-700">절감률</div>
              <div className="text-lg font-mono font-black text-emerald-700">{data.stats.savedPct}%</div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-700 text-center pt-1 border-t border-cyan-200">
            {data.startLabel} · {data.stops.length - 1}개 민원 순회
          </div>
        </div>
      )}

      {/* 지도 */}
      {data && data.stops.length > 1 && (
        <div className="bg-surface border-2 border-line rounded-lg overflow-hidden" style={{ height: 380 }}>
          <RouteMap
            mode="route"
            center={data.stops[0]}
            routeStops={data.stops}
            routeOrder={data.order}
            routePolyline={data.polyline ?? undefined}
            baseTile="osm"
          />
        </div>
      )}

      {/* 순회 목록 */}
      {data && data.stops.length > 1 && (
        <div className="bg-surface border-2 border-line rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-surface-soft border-b border-line text-xs font-extrabold text-ink">
            🛣 순회 순서
          </div>
          <ol className="divide-y divide-line">
            {data.order.map((idx, i) => {
              const stop = data.stops[idx];
              return (
                <li key={i} className="px-3 py-2.5 flex items-start gap-3">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-black ${
                    i === 0 ? 'bg-emerald-700 text-white' : i === data.order.length - 1 ? 'bg-purple-700 text-white' : 'bg-accent text-white'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink leading-tight">{stop.label}</div>
                    <div className="text-[10px] font-mono text-slate-700 mt-0.5">
                      {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!data && !busy && !error && (
        <div className="text-center py-8 text-sm text-slate-700 font-bold">
          위 버튼을 눌러 미처리 민원 경로를 계산하세요.
        </div>
      )}
    </div>
  );
}
