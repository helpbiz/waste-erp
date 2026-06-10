'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* 번호가 들어간 마커 아이콘 — 추천경로 시인성 향상 */
function makeNumberedIcon(num: number, isStart: boolean, isEnd: boolean = false): L.DivIcon {
  const bg = isStart ? '#dc2626' : isEnd ? '#7c3aed' : '#0e7490';
  const ring = isStart ? '#fecaca' : isEnd ? '#ddd6fe' : '#a5f3fc';
  const html = `
    <div style="position:relative;width:36px;height:46px;">
      <div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${bg};
        border:3px solid ${ring};
        box-shadow:0 3px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          color:white;font-weight:900;font-size:15px;
          font-family:'Noto Sans KR',sans-serif;
          line-height:1;
        ">${num}</span>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'numbered-marker',
    iconSize: [36, 46],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
  });
}

type VehicleMarker = { id: string; lat: number; lng: number; label: string; status: string; speed?: number };
type RouteStop = { lat: number; lng: number; label: string };

export type LeafletMapMode = 'vehicles' | 'heatmap' | 'route';

/* 베이스 타일 옵션 */
export type BaseTile = 'osm' | 'osm-hot' | 'cartodb-light' | 'cartodb-dark' | 'esri-sat' | 'esri-topo' | 'opentopomap';

const TILE_PROVIDERS: Record<BaseTile, { url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
  'osm': {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  'osm-hot': {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, Tiles courtesy of Humanitarian OSM',
    maxZoom: 19,
  },
  'cartodb-light': {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  'cartodb-dark': {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  'esri-sat': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
    maxZoom: 19,
  },
  'esri-topo': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  'opentopomap': {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
};

export default function LeafletMap({
  mode,
  center,
  vehicles,
  heatPoints,
  routeStops,
  routeOrder,
  routePolyline,
  baseTile = 'osm',
  selectedVehicleId,
  onVehicleClick,
}: {
  mode: LeafletMapMode;
  center: { lat: number; lng: number };
  vehicles?: VehicleMarker[];
  heatPoints?: Array<{ lat: number; lng: number; intensity: number; count?: number }>;
  routeStops?: RouteStop[];
  routeOrder?: number[];
  routePolyline?: Array<[number, number]>; // ORS/OSRM 도로 스냅 [lng,lat] 배열
  baseTile?: BaseTile;
  selectedVehicleId?: string;
  onVehicleClick?: (id: string) => void;
}) {
  const tile = TILE_PROVIDERS[baseTile] ?? TILE_PROVIDERS.osm;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        key={baseTile}
        url={tile.url}
        attribution={tile.attribution}
        maxZoom={tile.maxZoom}
        {...(tile.subdomains ? { subdomains: tile.subdomains } : {})}
      />

      {mode === 'vehicles' && vehicles && vehicles.map((v) => {
        const isSel = selectedVehicleId === v.id;
        const baseColor = v.status === 'MOVING' ? '#10b981' : v.status === 'STOP' ? '#f59e0b' : v.status === 'MAINTENANCE' ? '#ef4444' : '#94a3b8';
        return (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={isSel ? 13 : 9}
            pathOptions={{
              color: isSel ? '#1e40af' : baseColor,
              fillColor: baseColor,
              fillOpacity: 0.85,
              weight: isSel ? 3 : 2,
            }}
            eventHandlers={{ click: () => onVehicleClick?.(v.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={isSel}>
              <span className="font-extrabold text-xs">{v.label}</span>
            </Tooltip>
            <Popup>
              <div className="font-extrabold">{v.label}</div>
              {v.speed != null && <div>속도: {v.speed} km/h</div>}
              <div>상태: {v.status}</div>
            </Popup>
          </CircleMarker>
        );
      })}

      {mode === 'heatmap' && heatPoints && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

      {mode === 'route' && routeStops && routeOrder && routeOrder.length > 1 && (
        <>
          {/* 도로 스냅 polyline (OSRM/ORS) — 우선 */}
          {routePolyline && routePolyline.length > 1 ? (
            <Polyline
              positions={routePolyline.map((c) => [c[1], c[0]] as [number, number])}
              pathOptions={{ color: '#0e7490', weight: 5, opacity: 0.9 }}
            />
          ) : (
            /* fallback — stop만 잇는 직선 */
            <Polyline
              positions={routeOrder.map((i) => [routeStops[i].lat, routeStops[i].lng] as [number, number])}
              pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.6, dashArray: '8, 8' }}
            />
          )}
          {routeOrder.map((i, seq) => (
            <Marker
              key={`${i}-${seq}`}
              position={[routeStops[i].lat, routeStops[i].lng]}
              icon={makeNumberedIcon(seq + 1, seq === 0, seq === routeOrder.length - 1)}
            >
              <Popup>
                <div className="font-extrabold text-base">
                  #{seq + 1} {seq === 0 ? '(🏁 출발)' : seq === routeOrder.length - 1 ? '(🎯 도착)' : ''}
                </div>
                <div className="text-xs">{routeStops[i].label}</div>
              </Popup>
            </Marker>
          ))}
        </>
      )}
    </MapContainer>
  );
}

function HeatLayer({ points }: { points: Array<{ lat: number; lng: number; intensity: number }> }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  useEffect(() => {
    /* @ts-expect-error: leaflet.heat 타입 미정의 */
    const heat = L.heatLayer(points.map((p) => [p.lat, p.lng, p.intensity]), {
      radius: 22,
      blur: 28,
      minOpacity: 0.4,
      gradient: { 0.2: '#2c7bb6', 0.4: '#abd9e9', 0.6: '#fdae61', 0.8: '#d7191c', 1.0: '#7f0000' },
    });
    heat.addTo(map);
    layerRef.current = heat;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map, points]);
  return null;
}
