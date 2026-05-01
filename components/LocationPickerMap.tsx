'use client';

/**
 * LocationPickerMap — 민원 등록용 드래그 가능 지도
 * - admin/complaints + worker/complaint 공유
 * - leaflet은 SSR 불가 → 호출 측에서 dynamic import 필요
 */
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* leaflet 기본 아이콘 — 로컬 자산 (CSP unpkg 허용 불필요 + 오프라인 대응) */
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

/* 빨간색 위치 핀 (민원 발생지 강조) */
const COMPLAINT_PIN = L.divIcon({
  className: 'complaint-pin',
  html: `
    <div style="position:relative;width:32px;height:42px;">
      <div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:#dc2626;
        border:3px solid #fecaca;
        box-shadow:0 4px 10px rgba(220,38,38,0.45);
      "></div>
      <div style="
        position:absolute;top:7px;left:9px;
        width:14px;height:14px;border-radius:50%;
        background:white;
      "></div>
    </div>
  `,
  iconSize: [32, 42],
  iconAnchor: [16, 32],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom() ?? 16, 16));
  }, [lat, lng, map]);
  return null;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * BottomSheet 슬라이드 애니메이션 중 mount 되면 Leaflet 이 컨테이너 크기 0×0 으로 인식 →
 * 타일 fetch 안 함. invalidateSize() 를 다단계(100/300/600/1000ms) 강제 호출하여
 * 모달 트랜지션 완료 시점에 지도 크기 재인식 + 타일 로딩 트리거.
 */
function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const delays = [100, 300, 600, 1000];
    const timers = delays.map((d) =>
      setTimeout(() => {
        try { map.invalidateSize(false); } catch { /* unmount race */ }
      }, d),
    );
    /* window resize 시에도 즉시 보정 */
    const onResize = () => { try { map.invalidateSize(false); } catch { /* */ } };
    window.addEventListener('resize', onResize);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  height = 220,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  return (
    <div className="rounded-lg overflow-hidden border-2 border-line shadow-sm" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          /* CartoDB Positron — 글로벌 CDN, OSM 보다 응답 ~50% 빠름.
             CSP img-src 에 *.basemaps.cartocdn.com 이미 허용됨. */
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <Marker
          position={[lat, lng]}
          icon={COMPLAINT_PIN}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
        <ClickHandler onChange={onChange} />
        <Recenter lat={lat} lng={lng} />
        <ResizeFix />
      </MapContainer>
    </div>
  );
}
