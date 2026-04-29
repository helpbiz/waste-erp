// 기동반(RAPID) WORKER용 미처리 민원 추천경로 — 모바일 simplified UI
// API 재사용: POST /api/live-tracking/optimize-route (source=complaints 기본값)
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import NavButtons from '@/components/NavButtons';

const RouteMap = dynamic(() => import('@/app/(admin)/live-vehicles/_leaflet-map'), {
  ssr: false,
  loading: () => <div className="h-[280px] flex items-center justify-center text-slate-700 font-bold">지도 로드 중…</div>,
});

type Stop = { lat: number; lng: number; label: string; complaintId?: string };

type RouteResp = {
  ok: boolean;
  stops: Stop[];
  distanceKm: number;
  durationMin: number;
  baselineKm: number;
  savedKm: number;
  savedPct: number;
  polylineCoords?: Array<[number, number]>;
  polylineSource?: 'ors' | 'osrm' | 'straight' | null;
  startLabel?: string;
  routingMode?: string;
  note?: string;
  error?: string;
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
      const j: RouteResp = await r.json();
      if (!r.ok || !j.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setBusy(false);
    }
  }

  /* 정렬된 stops 가 곧 순회 순서 (API 가 이미 TSP 적용) */
  const order = data ? data.stops.map((_, i) => i) : [];

  return (
    /* w-full + overflow-x-hidden — 가로 스크롤 차단 (LeafletMap 등 자식 요소가 viewport 넘기지 않도록) */
    <div className="w-full max-w-full overflow-x-hidden px-3 py-3 space-y-3">
      {/* 컴팩트 액션 바 (sticky-top) — 버튼이 항상 화면 상단에 보이도록 */}
      <div className="bg-purple-600 rounded-lg p-3 shadow-card sticky top-0 z-10 -mx-3 px-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🚀</span>
          <h2 className="text-sm font-black text-white flex-1 leading-tight">기동반 추천경로</h2>
          <span className="text-xs font-mono font-extrabold text-purple-200 bg-purple-800/40 px-1.5 py-0.5 rounded">
            {positionLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="max-stops" className="text-xs font-mono font-extrabold text-purple-100 whitespace-nowrap">
            최대
          </label>
          <input
            id="max-stops"
            type="number"
            min={2}
            max={30}
            value={maxStops}
            onChange={(e) => setMaxStops(Math.max(2, Math.min(30, Number(e.target.value) || 15)))}
            className="w-14 px-2 py-2 rounded border-2 border-purple-300 text-sm font-mono font-bold text-ink min-h-[40px] text-center"
          />
          <span className="text-xs font-mono font-extrabold text-purple-100">곳</span>
          <button
            onClick={run}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-md bg-emerald-500 text-white text-sm font-extrabold hover:bg-emerald-400 disabled:opacity-60 active:scale-95 min-h-[44px] shadow-md whitespace-nowrap"
          >
            {busy ? '계산 중…' : '🚀 경로 최적화'}
          </button>
        </div>
      </div>

      {/* 안내 (초기) */}
      {!data && !busy && !error && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 text-center text-[0.75rem] font-bold text-purple-800 leading-snug">
          위 버튼을 누르면 미처리 민원을 모아 최단 순회 경로를 계산합니다.
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-3 py-3 text-sm font-bold text-red-800">
          오류: {error === 'no_complaints' ? '미처리 민원이 없습니다.' : error}
        </div>
      )}

      {/* 결과 통계 */}
      {data && data.stops.length > 0 && (
        <div className="bg-cyan-50 border-2 border-accent rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-white rounded p-2 min-w-0">
              <div className="text-xs font-mono font-extrabold text-slate-700">총 거리</div>
              <div className="text-base font-mono font-black text-accent truncate">{data.distanceKm} km</div>
            </div>
            <div className="bg-white rounded p-2 min-w-0">
              <div className="text-xs font-mono font-extrabold text-slate-700">예상 시간</div>
              <div className="text-base font-mono font-black text-accent truncate">{data.durationMin} 분</div>
            </div>
            <div className="bg-white rounded p-2 min-w-0">
              <div className="text-xs font-mono font-extrabold text-slate-700">절감 거리</div>
              <div className="text-base font-mono font-black text-emerald-700 truncate">{data.savedKm} km</div>
            </div>
            <div className="bg-white rounded p-2 min-w-0">
              <div className="text-xs font-mono font-extrabold text-slate-700">절감률</div>
              <div className="text-base font-mono font-black text-emerald-700 truncate">{data.savedPct}%</div>
            </div>
          </div>
          {data.startLabel && (
            <div className="text-xs font-mono text-slate-700 text-center pt-1 border-t border-cyan-200 truncate">
              {data.startLabel} · {Math.max(0, data.stops.length - 1)}개 민원 순회
            </div>
          )}
        </div>
      )}

      {/* 지도 — 너비 부모에 맞춤, 가로 overflow 차단 */}
      {data && data.stops.length > 1 && (
        <div className="bg-surface border-2 border-line rounded-lg overflow-hidden w-full" style={{ height: 320 }}>
          <RouteMap
            mode="route"
            center={data.stops[0]}
            routeStops={data.stops}
            routeOrder={order}
            routePolyline={data.polylineCoords ?? undefined}
            baseTile="osm"
          />
        </div>
      )}

      {/* 순회 목록 */}
      {data && data.stops.length > 1 && (
        <div className="bg-surface border-2 border-line rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-surface-soft border-b border-line text-xs font-extrabold text-ink">
            🛣 순회 순서 ({data.stops.length}곳)
          </div>
          <ol className="divide-y divide-line">
            {data.stops.map((stop, i) => (
              <li key={i} className="px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black ${
                    i === 0 ? 'bg-emerald-700 text-white' : i === data.stops.length - 1 ? 'bg-purple-700 text-white' : 'bg-accent text-white'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink leading-tight break-words">{stop.label}</div>
                    <div className="text-xs font-mono text-slate-700 mt-0.5 truncate">
                      {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
                {/* 내비 길안내 + 도착 확인 — 첫 stop(현재위치) 제외, 그 외 stop 마다 */}
                {i > 0 && (
                  <div className="ml-9 space-y-1.5">
                    <NavButtons
                      lat={stop.lat}
                      lng={stop.lng}
                      name={stop.label}
                      departEndpoint={stop.complaintId ? `/api/complaints/${stop.complaintId}/depart` : undefined}
                    />
                    {stop.complaintId && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await fetch(`/api/complaints/${stop.complaintId}/arrive`, { method: 'POST' });
                          if (r.ok) alert('도착 기록 완료');
                          else alert('도착 기록 실패');
                        }}
                        className="w-full px-2.5 py-1.5 rounded text-xs font-extrabold bg-cyan-600 hover:bg-cyan-700 text-white active:scale-95"
                      >
                        📍 도착 확인
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
