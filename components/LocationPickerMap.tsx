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

/* leaflet 기본 아이콘 CDN 보정 (next.js 번들 호환) */
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
      </MapContainer>
    </div>
  );
}
