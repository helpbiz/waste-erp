'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import MultiPhotoUploader from '@/components/MultiPhotoUploader';
import { useToast } from '@/components/ui/Toast';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import { formatKoreanPhone } from '@/lib/phone';

/* leaflet SSR 불가 — 동적 import */
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] rounded-lg border-2 border-line bg-surface-soft flex items-center justify-center text-xs font-mono text-ink-muted">
      🗺️ 지도 로딩 중…
    </div>
  ),
});

/* GPS 미확인 시 기본 지도 중심 — 서울시청 (사용자가 핀을 드래그하여 보정) */
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;

type Type = 'PICKUP_MISS' | 'ILLEGAL_DUMP' | 'ODOR_NOISE' | 'OTHER';

type GpsState =
  | { kind: 'idle' }
  | { kind: 'acquiring' }
  | { kind: 'ready'; lat: number; lng: number }
  | { kind: 'error'; message: string };

const TYPES: { id: Type; label: string; color: string }[] = [
  { id: 'PICKUP_MISS',  label: '수거 미비', color: 'bg-red-100 text-danger border-red-200' },
  { id: 'ILLEGAL_DUMP', label: '불법투기', color: 'bg-amber-100 text-warn border-amber-200' },
  { id: 'ODOR_NOISE',   label: '악취/소음', color: 'bg-blue-100 text-info border-blue-200' },
  { id: 'OTHER',        label: '기타',     color: 'bg-slate-100 text-ink-muted border-slate-200' },
];

export default function ComplaintClient() {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<Type | null>(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestGps();
  }, []);

  function requestGps() {
    if (!('geolocation' in navigator)) {
      setGps({ kind: 'error', message: '위치 정보 미지원' });
      return;
    }
    setGps({ kind: 'acquiring' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ kind: 'ready', lat: p.coords.latitude, lng: p.coords.longitude });
        reverseGeocode(p.coords.latitude, p.coords.longitude);
      },
      () => setGps({ kind: 'error', message: '위치 권한이 거부되었거나 신호가 약합니다.' })
    );
  }

  /* OSM Nominatim 역지오코딩 — 좌표 → 한글 주소 자동 입력 */
  async function reverseGeocode(lat: number, lng: number) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko&zoom=18`
      );
      if (r.ok) {
        const j = (await r.json()) as { display_name?: string };
        if (j.display_name && !address.trim()) setAddress(j.display_name);
      }
    } catch {
      /* 무시 — 사용자 직접 입력 가능 */
    }
  }

  /* 지도 핀 이동 — 좌표 보정 + 주소 재조회 */
  function onMapPinChange(lat: number, lng: number) {
    setGps({ kind: 'ready', lat, lng });
    reverseGeocode(lat, lng);
  }

  async function submit() {
    if (!type) {
      toast.warning('민원 유형을 선택해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { type };
      if (description.trim()) body.description = description.trim();
      if (phone.trim()) body.complainantPhone = phone.trim();
      if (address.trim()) body.locationAddress = address.trim();
      if (gps.kind === 'ready') {
        body.locationLat = gps.lat;
        body.locationLng = gps.lng;
      }
      if (photos.length > 0) body.requestImages = photos;
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        hapticError();
        toast.error(translate(data?.error) ?? '민원 등록에 실패했습니다.');
        return;
      }
      hapticSuccess();
      toast.success(`민원 접수 완료 #${data.complaint.id}`);
      setType(null);
      setAddress('');
      setDescription('');
      setPhone('');
      setPhotos([]);
      router.refresh();
    } catch {
      hapticError();
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-ink">민원 등록</h1>
        <p className="text-xs font-bold text-ink-muted mt-1">현장에서 발견한 민원을 등록합니다.</p>
      </div>

      {/* 인라인 성공 배너 → Toast (Wave 3-D) */}

      <Section label="민원 유형">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <label
              key={t.id}
              className={`px-3 py-3 rounded-lg border-2 ${t.color} text-center text-sm font-extrabold cursor-pointer active:scale-[0.98] transition ${type === t.id ? 'ring-2 ring-accent ring-offset-2' : ''}`}
            >
              <input
                type="radio"
                name="type"
                value={t.id}
                checked={type === t.id}
                onChange={() => setType(t.id)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </Section>

      <Section label="발생 위치 (지도에서 핀 클릭·드래그로 보정)">
        {/* 지도는 항상 표시 — GPS 미확인 시 기본 좌표(서울시청) + 사용자가 핀 드래그로 지정 */}
        <div className="mb-2 relative">
          <LocationPickerMap
            lat={gps.kind === 'ready' ? gps.lat : DEFAULT_LAT}
            lng={gps.kind === 'ready' ? gps.lng : DEFAULT_LNG}
            onChange={onMapPinChange}
            height={200}
          />
          {gps.kind !== 'ready' && (
            <div className="absolute top-2 left-2 right-2 px-3 py-1.5 rounded-md bg-amber-100/95 border border-amber-300 text-xs font-bold text-amber-900 backdrop-blur shadow-sm pointer-events-none">
              {gps.kind === 'acquiring' && '📍 GPS 위치 확인 중… (핀을 드래그해도 됩니다)'}
              {gps.kind === 'error' && `⚠️ ${gps.message} — 지도에서 핀을 드래그해 위치 지정`}
              {gps.kind === 'idle' && '핀을 드래그해 발생 위치를 지정하세요'}
            </div>
          )}
        </div>

        {/* GPS 상태 + 좌표 + 재시도 */}
        <div className="bg-surface-alt rounded-lg border border-line px-3 py-2 flex items-center gap-2 mb-2">
          <svg
            width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            className={gps.kind === 'ready' ? 'text-success' : gps.kind === 'error' ? 'text-danger' : 'text-warn'}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1 text-xs">
            {gps.kind === 'ready' && (
              <span className="font-mono font-bold text-ink">
                {gps.lat.toFixed(5)}°N, {gps.lng.toFixed(5)}°E
              </span>
            )}
            {gps.kind === 'acquiring' && '위치 확인 중…'}
            {gps.kind === 'error' && <span className="text-danger font-bold">{gps.message}</span>}
            {gps.kind === 'idle' && '위치 확인 대기'}
          </div>
          <button
            type="button"
            onClick={requestGps}
            className="text-xs font-mono font-extrabold px-2 py-1 rounded-md bg-surface border border-line active:scale-95"
          >
            🎯 내 위치
          </button>
        </div>

        {/* 주소 (역지오코딩 자동 입력 / 수정 가능) */}
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="상세 주소 (지도 클릭 시 자동 입력 · 수정 가능)"
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
        />
      </Section>

      <Section label="처리 내용 (선택)">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="현장 상황 / 즉시 처리 내용"
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
        />
      </Section>

      <Section label="민원인 연락처 (선택)">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
          placeholder="010-0000-0000"
          maxLength={13}
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-semibold focus:outline-none focus:border-accent"
        />
      </Section>

      <Section label="현장 사진 (최대 3장 · 카메라 직촬 가능)">
        <MultiPhotoUploader onChange={setPhotos} max={3} />
      </Section>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !type}
        className="w-full py-4 rounded-2xl bg-warn text-white text-base font-black shadow-card active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {busy ? '등록 중…' : '민원 등록'}
      </button>

      {/* 인라인 에러 배너 → Toast (Wave 3-D) */}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-ink mb-2 tracking-wide">{label}</div>
      {children}
    </div>
  );
}

function translate(code?: string): string | null {
  switch (code) {
    case 'gps_out_of_range': return 'GPS 좌표가 국내 범위를 벗어났습니다.';
    case 'no_contractor_assigned': return '소속 위탁업체가 지정되지 않았습니다.';
    case 'invalid_request': return '입력값이 올바르지 않습니다.';
    case 'unauthenticated': return '로그인이 만료되었습니다.';
    default: return null;
  }
}
