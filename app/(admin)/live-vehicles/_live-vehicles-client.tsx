'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

/* leaflet은 SSR 불가 — dynamic import */
const LeafletMap = dynamic(() => import('./_leaflet-map'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-ink-faint">지도 로드 중…</div>,
});

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  PRESS_REFUSE: '압착진개', COMPACTOR_REFUSE: '압축진개', ARM_ROLL: '암롤차',
  DUMP_TRUCK: '덤프트럭', GRAB_TRUCK: '집게차', CARGO_TRUCK: '카고트럭',
  REFUSE_DUMP: '진개덤프', TANK_LORRY: '탱크로리', WING_BODY: '윙바디',
  FORKLIFT: '지게차', OTHER: '기타',
};

type Position = {
  vehicleId: string;
  vehicleNo: string;
  vehicleType: string;
  vehicleStatus: string;
  driverName: string | null;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  operationalStatus: string;
  updatedAt: string;
};

type PositionsResponse = {
  provider: string;
  refreshSec: number;
  center: { lat: number; lng: number };
  vehicles: Position[];
  note: string;
};

type Config = {
  gisProvider: string;
  gisBaseUrl: string | null;
  hasApiKey: boolean;
  embedUrl: string | null;
  refreshSec: number;
  active: boolean;
  updatedAt: string;
};

type ContractorOpt = { id: string; name: string };

export default function LiveVehiclesClient({
  canManage: _canManage,
  isSuperAdmin = false,
  muniContractorOpts = [],
}: {
  canManage: boolean;
  isSuperAdmin?: boolean;
  muniContractorOpts?: ContractorOpt[];
}) {
  const [data, setData] = useState<PositionsResponse | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* 사용자 요청 2026-04-29: 시안 그리드 + 외부 GIS embed 탭 숨김 → 기본 'realmap' 으로 변경 */
  const [tab, setTab] = useState<'map' | 'realmap' | 'heatmap' | 'route' | 'embed'>('realmap');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 히트맵 */
  const [heatPoints, setHeatPoints] = useState<Array<{ lat: number; lng: number; intensity: number; count?: number }> | null>(null);
  const [heatStats, setHeatStats] = useState<{ totalPoints: number; cellsActive: number; range: { from: string; to: string } } | null>(null);
  const [heatFrom, setHeatFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [heatTo, setHeatTo] = useState(new Date().toISOString().slice(0, 10));

  /* 추천경로 */
  const [routeStops, setRouteStops] = useState<Array<{ lat: number; lng: number; label: string }> | null>(null);
  const [routeOrder, setRouteOrder] = useState<number[] | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]> | null>(null);
  const [routePolylineSource, setRoutePolylineSource] = useState<'ors' | 'osrm' | 'straight' | null>(null);
  const [routeStats, setRouteStats] = useState<{
    distanceKm: number; durationMin: number; baselineKm: number; savedKm: number; savedPct: number;
    algorithm: string; iterations: number; elapsedMs: number;
  } | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [maxStops, setMaxStops] = useState(20);

  /* 베이스 타일 */
  const [baseTile, setBaseTile] = useState<'osm' | 'osm-hot' | 'cartodb-light' | 'cartodb-dark' | 'esri-sat' | 'esri-topo' | 'opentopomap'>('osm');

  /* 전체화면 */
  const [fullscreen, setFullscreen] = useState(false);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      mapWrapRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) setFullscreen(false); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* SUPER_ADMIN: 조회할 업체 ID */
  const [superAdminCid, setSuperAdminCid] = useState('');
  const [contractorList, setContractorList] = useState<Array<{ id: string; companyName: string }>>([]);
  /* MUNI_ADMIN: 선택된 업체 ID (props로 전달된 목록 활용) */
  const [muniCid, setMuniCid] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch('/api/contractors')
      .then((r) => r.json())
      .then((d) => setContractorList(d.items ?? []))
      .catch(() => null);
  }, [isSuperAdmin]);

  async function loadHeatmap() {
    const r = await fetch(`/api/live-tracking/heatmap?from=${heatFrom}&to=${heatTo}`);
    if (r.ok) {
      const d = await r.json();
      setHeatPoints(d.points);
      setHeatStats({ totalPoints: d.totalPoints, cellsActive: d.cellsActive, range: d.range });
    }
  }

  async function runOptimize() {
    setRouteBusy(true);
    const r = await fetch('/api/live-tracking/optimize-route', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'complaints', maxStops }),
    });
    setRouteBusy(false);
    const d = await r.json();
    if (d.ok) {
      setRouteStops(d.stops.map((s: { lat: number; lng: number; label: string }) => ({ lat: s.lat, lng: s.lng, label: s.label })));
      setRouteOrder(d.stops.map((_: unknown, i: number) => i));
      setRoutePolyline(d.polylineCoords ?? null);
      setRoutePolylineSource(d.polylineSource ?? null);
      setRouteStats({
        distanceKm: d.distanceKm, durationMin: d.durationMin, baselineKm: d.baselineKm,
        savedKm: d.savedKm, savedPct: d.savedPct, algorithm: d.algorithm, iterations: d.iterations,
        elapsedMs: d.elapsedMs,
      });
    } else {
      alert('추천경로 실패: ' + (d.error ?? 'unknown'));
    }
  }

  const TILE_LABEL: Record<string, string> = {
    'osm': '🗺 OSM 표준',
    'osm-hot': '🌐 OSM HOT (구호용 명도)',
    'cartodb-light': '☁ Carto Light',
    'cartodb-dark': '🌙 Carto Dark',
    'esri-sat': '🛰 ESRI 위성영상',
    'esri-topo': '⛰ ESRI 지형도',
    'opentopomap': '🗻 OpenTopoMap',
  };

  function positionsUrl(cid?: string) {
    const id = cid ?? superAdminCid ?? muniCid;
    return id ? `/api/live-tracking/positions?contractorId=${id}` : '/api/live-tracking/positions';
  }

  async function load(cid?: string) {
    const r = await fetch(positionsUrl(cid));
    if (r.ok) setData(await r.json());
  }
  async function loadConfig(cid?: string) {
    const id = cid ?? superAdminCid ?? muniCid;
    const qs = id ? `?contractorId=${id}` : '';
    const r = await fetch(`/api/live-tracking/config${qs}`);
    if (r.ok) {
      const d = await r.json();
      setConfig(d.config);
    }
  }

  useEffect(() => {
    load();
    loadConfig();
  }, []);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (data) {
      timer.current = setInterval(() => load(), (data.refreshSec ?? 5) * 1000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [data?.refreshSec, superAdminCid, muniCid]); // eslint-disable-line react-hooks/exhaustive-deps

  const movingCount = data?.vehicles.filter((v) => v.operationalStatus === 'MOVING').length ?? 0;
  const stoppedCount = data?.vehicles.filter((v) => v.operationalStatus === 'STOP').length ?? 0;
  const idleCount = data?.vehicles.filter((v) => v.operationalStatus === 'IDLE').length ?? 0;
  const maintCount = data?.vehicles.filter((v) => v.operationalStatus === 'MAINTENANCE').length ?? 0;

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-purple-50 border border-purple-300 rounded-lg px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-extrabold text-purple-800">슈퍼관리자 — 업체 선택:</span>
          <select
            value={superAdminCid}
            onChange={(e) => setSuperAdminCid(e.target.value)}
            className="px-3 py-1 rounded border-2 border-purple-300 text-sm font-bold w-56 bg-white"
          >
            <option value="">— 전체 —</option>
            {contractorList.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { load(superAdminCid); loadConfig(superAdminCid); }}
            className="px-3 py-1 rounded text-sm font-extrabold bg-purple-600 text-white hover:bg-purple-700"
          >
            조회
          </button>
        </div>
      )}

      {/* MUNI_ADMIN 업체 탭 필터 */}
      {muniContractorOpts.length >= 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setMuniCid(''); load(''); loadConfig(''); }}
            className={`px-3 py-1.5 rounded-full text-sm font-extrabold whitespace-nowrap transition ${
              !muniCid ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
            }`}
          >전체 업체</button>
          {muniContractorOpts.map((c) => (
            <button key={c.id}
              onClick={() => { setMuniCid(c.id); load(c.id); loadConfig(c.id); }}
              className={`px-3 py-1.5 rounded-full text-sm font-extrabold whitespace-nowrap transition ${
                muniCid === c.id ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
              }`}
            >{c.name}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">실시간 차량조회</h2>
        <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-red-600 text-white animate-pulse">● LIVE</span>
        <span className="text-sm font-mono text-ink-faint">
          {data?.provider === 'simulation' ? '시안 모드 (시뮬 GPS)' : `GIS: ${data?.provider ?? '-'}`}
          {data && ` · ${data.refreshSec}초 폴링`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* 사용자 요청 2026-04-29: 즉시 갱신 버튼 앞 🔄 아이콘 제거 */}
          <button type="button" onClick={() => load()}
            className="px-3 py-1.5 rounded text-sm font-extrabold bg-white border-2 border-line hover:bg-slate-50">
            즉시 갱신
          </button>
          {isSuperAdmin && (
            <a href="/super-admin"
              className="px-3 py-1.5 rounded text-sm font-extrabold bg-purple-600 text-white hover:bg-purple-700"
              title="GIS API 설정은 슈퍼관리자 메뉴로 이관됨">
              ⚙ GIS 설정 (슈퍼관리자)
            </a>
          )}
        </div>
      </div>

      {/* GPS 단말 직접수신 모드 안내 */}
      {data?.provider === 'local' && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3 text-sm font-semibold text-emerald-900 space-y-1">
          <div className="font-extrabold">📡 GPS 단말 직접 수신 모드 (local)</div>
          <div>GPS 단말이 아래 엔드포인트로 위치를 Push합니다.</div>
          <div className="bg-white border border-emerald-200 rounded px-3 py-2 font-mono text-[0.6875rem] break-all">
            POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/live-tracking/gps-ingest?contractorId=<em>CONTRACTOR_ID</em>
          </div>
          <div>헤더: <code className="bg-white px-1 rounded">Authorization: Bearer &lt;인제스트토큰&gt;</code></div>
          <div>바디: <code className="bg-white px-1 rounded">{'{ "vehicleNo":"12가3456", "lat":37.49, "lng":127.04, "speed":30, "heading":90 }'}</code></div>
          <div className="text-emerald-700">인제스트 토큰은 GIS 설정 페이지에서 API 키로 입력하세요.</div>
        </div>
      )}

      {/* 4 KPI */}
      <div className="grid grid-cols-4 gap-3">
        <KCard label="운행 중" value={movingCount} unit="대" tone="success" />
        <KCard label="정차" value={stoppedCount} unit="대" tone="warning" />
        <KCard label="대기" value={idleCount} unit="대" />
        <KCard label="정비중" value={maintCount} unit="대" tone="alert" />
      </div>

      {/* 탭 — 사용자 요청 2026-04-29: 시안 그리드 + 외부 GIS embed 탭 숨김 */}
      <div className="flex gap-1 border-b-2 border-line">
        <TabBtn active={tab === 'realmap'} onClick={() => setTab('realmap')}>🌍 지도표시 (OSM)</TabBtn>
        <TabBtn active={tab === 'heatmap'} onClick={() => { setTab('heatmap'); if (!heatPoints) loadHeatmap(); }}>🔥 수거 히트맵</TabBtn>
        <TabBtn active={tab === 'route'} onClick={() => setTab('route')}>🛣 추천경로 계산</TabBtn>
      </div>

      {tab === 'map' && (
        <div className="grid grid-cols-[300px,1fr] gap-3">
          {/* 좌측 차량 리스트 */}
          <div className="bg-surface border border-line rounded-lg overflow-hidden max-h-[640px] overflow-y-auto">
            <div className="px-3 py-2 bg-slate-100 border-b border-line text-sm font-extrabold text-ink sticky top-0">
              차량 목록 ({data?.vehicles.length ?? 0})
            </div>
            {(data?.vehicles ?? []).map((v) => (
              <button key={v.vehicleId} onClick={() => setSelectedId(v.vehicleId)}
                className={`w-full text-left px-3 py-2 border-b border-line hover:bg-slate-50 ${selectedId === v.vehicleId ? 'bg-accent-soft border-l-[3px] border-l-accent' : ''}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-ink text-sm">{v.vehicleNo}</span>
                  <StatusDot status={v.operationalStatus} />
                  <span className="text-[0.625rem] font-mono font-extrabold text-ink-faint ml-auto">
                    {v.speed} km/h
                  </span>
                </div>
                <div className="text-[0.625rem] font-mono text-ink-faint">
                  {VEHICLE_TYPE_LABEL[v.vehicleType] ?? v.vehicleType} · {v.driverName ?? '운전자 미배정'}
                </div>
                <div className="text-[0.5625rem] font-mono text-ink-faint mt-0.5">
                  {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
                </div>
              </button>
            ))}
            {(!data || data.vehicles.length === 0) && (
              <div className="px-3 py-10 text-center text-ink-faint text-sm">활성 차량 없음</div>
            )}
          </div>

          {/* 지도 그리드 (시안) */}
          <div className="bg-emerald-50/40 border-2 border-line rounded-lg p-3 relative" style={{ minHeight: 600 }}>
            <div className="text-[0.625rem] font-mono font-bold text-ink-faint mb-2">
              📍 강남구 중심 ({data?.center?.lat?.toFixed(4) ?? '—'}, {data?.center?.lng?.toFixed(4) ?? '—'}) · 시안: 30초 단위 시뮬 위치
            </div>
            {/* 격자 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
              <svg className="w-full h-full opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
                {Array.from({ length: 11 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#475569" strokeWidth="0.1" />
                ))}
                {Array.from({ length: 11 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#475569" strokeWidth="0.1" />
                ))}
              </svg>
            </div>
            {/* 차량 마커 */}
            {data && (
              <div className="relative w-full h-[560px]">
                {data.vehicles.map((v) => {
                  /* 좌표 → SVG 영역 (lat/lng 정규화) */
                  const x = ((v.lng - (data.center.lng - 0.025)) / 0.05) * 100;
                  const y = (1 - (v.lat - (data.center.lat - 0.025)) / 0.05) * 100;
                  const xc = Math.max(2, Math.min(98, x));
                  const yc = Math.max(2, Math.min(98, y));
                  const isSel = selectedId === v.vehicleId;
                  const color = v.operationalStatus === 'MOVING' ? 'bg-emerald-500' :
                    v.operationalStatus === 'STOP' ? 'bg-amber-500' :
                    v.operationalStatus === 'MAINTENANCE' ? 'bg-red-500' : 'bg-slate-400';
                  return (
                    <button key={v.vehicleId}
                      onClick={() => setSelectedId(v.vehicleId)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isSel ? 'z-20' : 'z-10'}`}
                      style={{ left: `${xc}%`, top: `${yc}%` }}>
                      <div className={`relative ${isSel ? 'scale-125' : ''} transition-transform`}>
                        <div className={`w-4 h-4 rounded-full ${color} border-2 border-white shadow-lg ${v.operationalStatus === 'MOVING' ? 'animate-pulse' : ''}`}
                          style={{ transform: v.operationalStatus === 'MOVING' ? `rotate(${v.heading}deg)` : 'none' }} />
                        {(isSel || v.operationalStatus === 'MOVING') && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 bg-white rounded shadow border border-line whitespace-nowrap">
                            <div className="text-[0.625rem] font-extrabold text-ink">{v.vehicleNo}</div>
                            {isSel && (
                              <div className="text-[0.5625rem] font-mono text-ink-faint">{v.speed}km/h</div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 범례 */}
            <div className="absolute bottom-3 right-3 bg-white border border-line rounded p-2 shadow text-[0.625rem] font-bold space-y-0.5">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />운행중</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />정차</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white" />대기</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />정비중</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'realmap' && data && (
        <div className="flex flex-col gap-2">
          {/* 컨트롤 바 */}
          <div className="bg-surface border border-line rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-extrabold text-ink shrink-0">베이스 타일:</span>
            <select value={baseTile} onChange={(e) => setBaseTile(e.target.value as typeof baseTile)}
              className="px-2 py-1 rounded border-2 border-line text-sm font-bold bg-white">
              {Object.entries(TILE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-[0.625rem] font-mono text-ink-faint">차량 {data.vehicles.length}대 · {data.refreshSec}초 폴링</span>
            <button type="button" onClick={toggleFullscreen}
              title={fullscreen ? '전체화면 해제' : '지도 전체화면'}
              className="ml-auto px-3 py-1.5 rounded text-sm font-extrabold bg-white border-2 border-line hover:bg-slate-50 flex items-center gap-1.5">
              {fullscreen ? (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15v4.5M9 15H4.5M15 15h4.5M15 15v4.5" />
                </svg>축소</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>전체화면</>
              )}
            </button>
          </div>

          {/* Split View — 차량 목록 + 지도 */}
          <div ref={mapWrapRef} className="flex gap-0 border border-line rounded-lg overflow-hidden bg-surface"
            style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
            {/* 좌측 차량 목록 */}
            <div className="w-[230px] shrink-0 flex flex-col border-r border-line bg-white">
              <div className="px-3 py-2 bg-slate-100 border-b border-line text-sm font-extrabold text-ink shrink-0">
                차량 목록 ({data.vehicles.length})
              </div>
              <div className="overflow-y-auto flex-1">
                {data.vehicles.length === 0 && (
                  <div className="px-3 py-10 text-center text-ink-faint text-sm">활성 차량 없음</div>
                )}
                {data.vehicles.map((v) => (
                  <button key={v.vehicleId} type="button"
                    onClick={() => setSelectedId((prev) => prev === v.vehicleId ? null : v.vehicleId)}
                    className={`w-full text-left px-3 py-2 border-b border-line transition hover:bg-slate-50 ${
                      selectedId === v.vehicleId ? 'bg-accent-soft border-l-[3px] border-l-accent' : ''
                    }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-ink text-sm truncate flex-1">{v.vehicleNo}</span>
                      <StatusDot status={v.operationalStatus} />
                    </div>
                    <div className="text-[0.625rem] font-mono text-ink-faint truncate">
                      {VEHICLE_TYPE_LABEL[v.vehicleType] ?? v.vehicleType}
                      {v.driverName ? ` · ${v.driverName}` : ' · 미배정'}
                    </div>
                    <div className="text-[0.5625rem] font-mono text-ink-faint flex items-center gap-1 mt-0.5">
                      <span>{v.speed} km/h</span>
                      {v.updatedAt && <><span>·</span><span>{new Date(v.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>}
                    </div>
                  </button>
                ))}
              </div>

              {/* 선택 차량 상세 패널 */}
              {selectedId && (() => {
                const sel = data.vehicles.find((v) => v.vehicleId === selectedId);
                if (!sel) return null;
                return (
                  <div className="border-t-2 border-accent bg-accent-soft px-3 py-2 shrink-0">
                    <div className="text-[0.625rem] font-extrabold text-accent mb-1">선택 차량</div>
                    <div className="font-extrabold text-ink text-sm">{sel.vehicleNo}</div>
                    <div className="text-[0.625rem] font-mono text-ink-muted space-y-0.5 mt-1">
                      <div>{VEHICLE_TYPE_LABEL[sel.vehicleType] ?? sel.vehicleType}</div>
                      <div>운전자: {sel.driverName ?? '미배정'}</div>
                      <div>속도: {sel.speed} km/h</div>
                      <div>좌표: {sel.lat.toFixed(5)}, {sel.lng.toFixed(5)}</div>
                      <div className="pt-0.5"><StatusDot status={sel.operationalStatus} /></div>
                    </div>
                    <button type="button" onClick={() => setSelectedId(null)}
                      className="mt-1.5 text-[0.625rem] font-bold text-ink-faint hover:text-ink">
                      선택 해제
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* 우측 지도 */}
            <div className="flex-1" style={{ position: 'relative', zIndex: 0 }}>
              <LeafletMap
                mode="vehicles"
                center={data.center}
                baseTile={baseTile}
                selectedVehicleId={selectedId ?? undefined}
                onVehicleClick={(id) => setSelectedId((prev) => prev === id ? null : id)}
                vehicles={data.vehicles.map((v) => ({
                  id: v.vehicleId,
                  lat: v.lat,
                  lng: v.lng,
                  label: `${v.vehicleNo} (${VEHICLE_TYPE_LABEL[v.vehicleType] ?? v.vehicleType})`,
                  status: v.operationalStatus,
                  speed: v.speed,
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'heatmap' && (
        <div className="space-y-3">
          <div className="bg-surface border border-line rounded-lg p-3 flex items-center gap-2">
            <span className="text-sm font-extrabold text-ink">🔥 수거 히트맵</span>
            <input type="date" value={heatFrom} onChange={(e) => setHeatFrom(e.target.value)}
              className="px-2 py-1 rounded border border-line text-sm font-mono" />
            <span className="text-ink-faint">~</span>
            <input type="date" value={heatTo} onChange={(e) => setHeatTo(e.target.value)}
              className="px-2 py-1 rounded border border-line text-sm font-mono" />
            <button onClick={loadHeatmap}
              className="px-3 py-1 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
              조회
            </button>
            {heatStats && (
              <span className="ml-auto text-[0.625rem] font-mono text-ink-faint">
                민원 {heatStats.totalPoints}건 · 활성 셀 {heatStats.cellsActive}개 · {heatStats.range.from}~{heatStats.range.to}
              </span>
            )}
          </div>
          <div className="bg-surface border border-line rounded-lg overflow-hidden" style={{ height: 600 }}>
            {data && heatPoints && (
              <LeafletMap mode="heatmap" center={data.center} heatPoints={heatPoints} baseTile={baseTile} />
            )}
            {(!heatPoints || heatPoints.length === 0) && (
              <div className="flex items-center justify-center h-full text-ink-faint">
                {heatPoints ? '해당 기간 민원 데이터 없음' : '조회 버튼을 눌러 히트맵 생성'}
              </div>
            )}
          </div>
          <div className="text-[0.625rem] font-mono text-ink-faint px-2 bg-slate-50 rounded p-2">
            💡 알고리즘 (gis-cost 동등): 50m 그리드 density + BULKY_WASTE/ILLEGAL_DUMP 2배 가중치 + Folium HeatMap 동등 그라디언트 (blue→cyan→orange→red→maroon)
          </div>
        </div>
      )}

      {tab === 'route' && (
        <div className="space-y-3">
          <div className="bg-surface border border-line rounded-lg p-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-ink">🛣 추천경로 계산 (TSP)</span>
            <label className="text-sm font-mono ml-3">최대 stops:
              <input type="number" min="2" max="50" value={maxStops} onChange={(e) => setMaxStops(Number(e.target.value))}
                className="ml-1 px-2 py-1 rounded border border-line w-20 font-mono font-bold" />
            </label>
            <button onClick={runOptimize} disabled={routeBusy}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {routeBusy ? '계산 중…' : '🚀 미처리 민원으로 경로 최적화'}
            </button>
            {routeStats && (
              <div className="ml-auto text-[0.6875rem] font-mono">
                <span className="font-extrabold text-emerald-700">{routeStats.distanceKm} km</span> · {routeStats.durationMin}분 ·
                절감 <span className="font-extrabold text-accent">{routeStats.savedKm} km ({routeStats.savedPct}%)</span>
              </div>
            )}
          </div>
          <div className="bg-surface border border-line rounded-lg overflow-hidden" style={{ height: 600 }}>
            {data && routeStops && routeOrder && (
              <LeafletMap
                mode="route"
                center={data.center}
                routeStops={routeStops}
                routeOrder={routeOrder}
                routePolyline={routePolyline ?? undefined}
                baseTile={baseTile}
              />
            )}
            {!routeStops && (
              <div className="flex items-center justify-center h-full text-ink-faint">
                "🚀 경로 최적화" 버튼을 눌러주세요
              </div>
            )}
          </div>
          {routeStats && (
            <div className="bg-emerald-50 border border-emerald-300 rounded p-3 text-sm">
              <div className="font-extrabold text-emerald-900 mb-1">최적화 결과</div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>알고리즘: <span className="font-extrabold">{routeStats.algorithm}</span></div>
                <div>2-opt 반복: <span className="font-extrabold">{routeStats.iterations}회</span></div>
                <div>총 거리: <span className="font-extrabold text-emerald-700">{routeStats.distanceKm} km</span> (입력순서: {routeStats.baselineKm} km)</div>
                <div>예상 시간: <span className="font-extrabold">{routeStats.durationMin} 분</span> (도심 25km/h)</div>
                <div>절감: <span className="font-extrabold text-accent">{routeStats.savedKm} km ({routeStats.savedPct}%)</span></div>
                <div>실행 시간: {routeStats.elapsedMs} ms</div>
                {routePolylineSource && (
                  <div className="col-span-2">
                    polyline source:{' '}
                    <span className={`font-extrabold px-1.5 py-0.5 rounded text-[0.625rem] ${
                      routePolylineSource === 'osrm' ? 'bg-emerald-200 text-emerald-900' :
                      routePolylineSource === 'ors' ? 'bg-cyan-200 text-cyan-900' :
                      'bg-amber-200 text-amber-900'
                    }`}>
                      {routePolylineSource === 'osrm' ? '🛣 OSRM 도로 스냅 (실 도로망)' :
                       routePolylineSource === 'ors' ? '🛣 ORS 도로 스냅 (실 도로망)' :
                       '⚠ 직선 (라우팅 서버 응답 실패 — fallback)'}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-[0.625rem] text-ink-faint mt-2">
                💡 알고리즘 (gis-cost 동등): Nearest Neighbor 초기해 + 2-opt 개선. polyline은 OSRM 공개 데모(키 불필요)로 도로 따라 그려짐.
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'embed' && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          {config?.embedUrl ? (
            <iframe src={config.embedUrl} className="w-full" style={{ height: 700, border: 0 }} title="GIS Live View" />
          ) : (
            <div className="text-center py-20 text-ink-faint">
              <div className="text-2xl mb-2">🔗</div>
              <div className="font-bold mb-1">외부 GIS embed URL이 설정되지 않았습니다</div>
              <div className="text-sm font-mono">
                관리자가 ⚙ GIS API 설정에서 embed URL을 입력하면 외부 시스템(예: gis.helpbiz.kr) 화면을 직접 표시합니다.
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function SettingsModal({ config, onClose, onSaved }: {
  config: Config | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    gisProvider: config?.gisProvider ?? 'simulation',
    gisBaseUrl: config?.gisBaseUrl ?? '',
    apiKey: '',
    embedUrl: config?.embedUrl ?? '',
    refreshSec: config?.refreshSec ?? 5,
    active: config?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      gisProvider: form.gisProvider,
      gisBaseUrl: form.gisBaseUrl || null,
      embedUrl: form.embedUrl || null,
      refreshSec: form.refreshSec,
      active: form.active,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;
    const res = await fetch('/api/live-tracking/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[560px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line">
          <h3 className="font-extrabold text-ink">GIS 연동 설정</h3>
        </div>
        <div className="p-5 space-y-3">
          <Field label="GIS Provider">
            <select value={form.gisProvider} onChange={(e) => setForm({ ...form, gisProvider: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold">
              <option value="simulation">simulation (시안 시뮬)</option>
              <option value="helpbiz">helpbiz (gis.helpbiz.kr)</option>
              <option value="naver">naver maps</option>
              <option value="kakao">kakao mobility</option>
            </select>
          </Field>
          <Field label="GIS Base URL (API)">
            <input value={form.gisBaseUrl} onChange={(e) => setForm({ ...form, gisBaseUrl: e.target.value })}
              placeholder="https://gis.helpbiz.kr/api"
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
          </Field>
          <Field label="API Key (저장 시 AES-256 암호화)">
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={config?.hasApiKey ? '••••••• (저장됨, 변경 시만 입력)' : 'API Key'}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
          </Field>
          <Field label="Embed URL (외부 GIS 화면 직접 삽입 — 선택)">
            <input value={form.embedUrl} onChange={(e) => setForm({ ...form, embedUrl: e.target.value })}
              placeholder="https://gis.helpbiz.kr/embed?key=..."
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
          </Field>
          <Field label="갱신 주기 (초)">
            <input type="number" min="2" max="300" value={form.refreshSec} onChange={(e) => setForm({ ...form, refreshSec: Number(e.target.value) })}
              className="w-32 px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            연동 활성화
          </label>
          <div className="text-[0.625rem] font-mono text-ink-faint bg-slate-50 rounded p-2">
            💡 Provider=simulation: 강남구 그리드에서 시뮬 GPS<br />
            💡 Provider=helpbiz: API key + Base URL로 외부 호출 (Phase 2 구현 예정)<br />
            💡 Embed URL: iframe으로 외부 화면 직접 표시 (Provider 무관)
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
          <button disabled={saving} onClick={save}
            className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Field as _F } from '@/components/Field';
const Field = (p: React.ComponentProps<typeof _F>) => <_F {...p} labelClassName={p.labelClassName ?? 'block text-[0.6875rem] font-mono font-extrabold text-ink-faint mb-1'} />;

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-extrabold border-b-[3px] -mb-0.5 transition ${
        active ? 'border-accent text-accent bg-accent-soft' : 'border-transparent text-ink-muted hover:bg-slate-100'
      }`}>{children}</button>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    MOVING: { color: 'bg-emerald-500', label: '운행' },
    STOP: { color: 'bg-amber-500', label: '정차' },
    IDLE: { color: 'bg-slate-400', label: '대기' },
    MAINTENANCE: { color: 'bg-red-500', label: '정비' },
  };
  const m = map[status] ?? map.IDLE;
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${m.color} ${status === 'MOVING' ? 'animate-pulse' : ''}`} />
      <span className="text-[0.5625rem] font-mono font-extrabold text-ink-faint">{m.label}</span>
    </span>
  );
}

function KCard({ label, value, unit, tone = 'default' }: { label: string; value: number; unit: string; tone?: 'default' | 'success' | 'warning' | 'alert' }) {
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    warning: 'bg-amber-100 border-amber-500 text-amber-900',
    alert: 'bg-red-100 border-red-500 text-red-900',
  };
  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${c[tone]} shadow-sm`}>
      <div className="text-[0.75rem] font-extrabold tracking-tight">{label}</div>
      <div className="font-black mt-0.5"><span className="text-2xl">{value}</span> <span className="text-sm font-bold">{unit}</span></div>
    </div>
  );
}
