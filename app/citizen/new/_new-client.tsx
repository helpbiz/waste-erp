'use client';

/**
 * 도 7 — 민원 요청 시점 (710)
 *  - (711) 폐기물 사진 촬영·첨부
 *  - (713) 긴급 처리 특이사항 선택 (LONG_NEGLECTED / ROAD_KILL / KIDS_DANGER / OTHER)
 *  - 민원 유형 + 위치 (GPS) + 상세 주소
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import MultiPhotoUploader from '@/components/MultiPhotoUploader';

/* leaflet SSR 불가 — 동적 import */
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] rounded-lg border-2 border-line bg-surface-soft flex items-center justify-center text-xs font-mono text-ink-muted">
      🗺️ 지도 로딩 중…
    </div>
  ),
});

/* GPS 미확인 시 기본 지도 중심 (서울시청) */
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;

const TYPES = [
  { id: 'PICKUP_MISS',  label: '수거 미비',  emoji: '🗑',  bg: 'bg-red-50 border-red-300 text-red-700' },
  { id: 'ILLEGAL_DUMP', label: '불법투기',  emoji: '⚠️', bg: 'bg-amber-50 border-amber-300 text-amber-700' },
  { id: 'ODOR_NOISE',   label: '악취/소음',  emoji: '👃', bg: 'bg-blue-50 border-blue-300 text-blue-700' },
  { id: 'OTHER',        label: '기타',       emoji: '📝', bg: 'bg-slate-50 border-slate-300 text-ink-muted' },
] as const;

const URGENT_TAGS = [
  { id: 'LONG_NEGLECTED', label: '오래 방치됨', emoji: '⏰' },
  { id: 'ROAD_KILL',      label: '동물 로드킬', emoji: '🐾' },
  { id: 'KIDS_DANGER',    label: '아이들 위험', emoji: '⚠️' },
  { id: 'OTHER',          label: '직접 입력',   emoji: '✏️' },
] as const;

type CType = typeof TYPES[number]['id'];
type UTag = typeof URGENT_TAGS[number]['id'];

export default function NewComplaintClient() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CType | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentTag, setUrgentTag] = useState<UTag | null>(null);
  const [urgentNote, setUrgentNote] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; eta: string | null; flagged: boolean } | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('citizen-phone') ?? '');
    setName(localStorage.getItem('citizen-name') ?? '');
    pickGps();
  }, []);

  function pickGps() {
    if (!('geolocation' in navigator)) {
      setGpsErr('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }
    setGpsErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude });
        reverseGeocode(p.coords.latitude, p.coords.longitude);
      },
      (e) => setGpsErr(e.code === 1 ? '위치 권한이 거부되었습니다. 지도에서 핀을 끌어주세요.' : '위치 신호를 확인할 수 없어요. 지도에서 핀을 끌어주세요.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* OSM Nominatim 역지오코딩 */
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
      /* 무시 */
    }
  }

  function onMapPinChange(lat: number, lng: number) {
    setGps({ lat, lng });
    setGpsErr(null);
    reverseGeocode(lat, lng);
  }

  async function submit() {
    if (!type) { setError('민원 유형을 선택해 주세요.'); return; }
    if (!gps) { setError('현재 위치 또는 주소가 필요합니다.'); return; }
    if (!phone) { setError('휴대폰 번호 인증이 필요합니다.'); return; }
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        citizenPhone: phone,
        citizenName: name || undefined,
        type,
        description: description.trim() || undefined,
        locationLat: gps.lat,
        locationLng: gps.lng,
        locationAddress: address.trim() || undefined,
        isUrgent,
        urgentTag: isUrgent ? (urgentTag ?? 'OTHER') : undefined,
        requestImages: photos.length > 0 ? photos : undefined,
      };
      if (urgentTag === 'OTHER' && urgentNote.trim()) {
        body.description = (body.description ? body.description + '\n\n' : '') + `[기타: ${urgentNote.trim()}]`;
      }
      const res = await fetch('/api/citizen/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === 'gps_out_of_range' ? '국내 좌표만 신고 가능합니다.' : (data?.error ?? '등록 실패'));
        return;
      }
      setSuccess({
        id: data.complaint.id,
        eta: data.complaint.arrivalEta ?? null,
        flagged: !!data.complaint.flagged,
      });
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="px-4 py-8 space-y-5 text-center">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-black text-success">민원 접수 완료</h2>
        <div className="bg-surface-soft rounded-xl border border-line p-4 text-left">
          <div className="text-xs font-bold text-ink-muted">민원번호</div>
          <div className="text-lg font-mono font-extrabold text-ink">#{success.id}</div>
          {success.eta && (
            <>
              <div className="text-xs font-bold text-ink-muted mt-3">예상 처리 도착 시각 (특허 청구항 7)</div>
              <div className="text-lg font-mono font-extrabold text-info">
                {new Date(success.eta).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[0.625rem] font-mono text-ink-faint mt-0.5">담당 차량 위치 + 평균 주행속도 기반 추정</div>
            </>
          )}
        </div>
        {success.flagged && (
          <div className="bg-red-50 border border-red-300 border-l-4 border-l-danger rounded-md px-4 py-3 text-xs font-bold text-red-700 leading-relaxed text-left">
            <strong className="font-extrabold">⚠ 자동 검토 대상 (청구항 6)</strong> · 60분 이내 5건 이상 신고하셨습니다. 무단 투기·허위 신고 후보 목록에 추가되었으며 감독 기관에 CCTV 영상 확인이 요청되었습니다.
          </div>
        )}
        <Link href="/citizen" className="block w-full py-3.5 rounded-lg bg-accent text-white font-extrabold shadow-card">
          내 민원 현황 보기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 도7 711 — 폐기물 사진 (최대 3장) */}
      <section>
        <h3 className="text-sm font-extrabold text-ink mb-2">📷 폐기물 사진 (최대 3장 · 권장)</h3>
        <MultiPhotoUploader onChange={setPhotos} max={3} />
      </section>

      {/* 민원 유형 */}
      <section>
        <h3 className="text-sm font-extrabold text-ink mb-2">민원 유형</h3>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`px-3 py-3 rounded-lg border-2 text-sm font-extrabold flex items-center gap-2 active:scale-[0.98] ${t.bg} ${type === t.id ? 'ring-2 ring-accent ring-offset-2' : ''}`}
            >
              <span className="text-xl">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 도7 713 — 긴급 처리 특이사항 */}
      <section>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => { setIsUrgent(e.target.checked); if (!e.target.checked) setUrgentTag(null); }}
            className="w-5 h-5 accent-danger"
          />
          <span className="text-sm font-extrabold text-danger">🚨 긴급 처리 필요</span>
        </label>
        {isUrgent && (
          <div className="space-y-2 pl-7">
            <div className="text-[0.6875rem] font-bold text-ink-muted">긴급 사유 선택 (특이사항)</div>
            <div className="grid grid-cols-2 gap-2">
              {URGENT_TAGS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUrgentTag(u.id)}
                  className={`px-3 py-2.5 rounded-md border-2 text-xs font-extrabold flex items-center gap-2 ${urgentTag === u.id ? 'border-danger bg-red-50 text-danger' : 'border-line bg-surface text-ink'}`}
                >
                  <span>{u.emoji}</span>{u.label}
                </button>
              ))}
            </div>
            {urgentTag === 'OTHER' && (
              <input
                value={urgentNote}
                onChange={(e) => setUrgentNote(e.target.value)}
                placeholder="긴급 사유를 직접 입력해 주세요"
                className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-danger"
              />
            )}
          </div>
        )}
      </section>

      {/* 발생 위치 — 지도 자동 표시 + 핀 드래그 보정 */}
      <section>
        <h3 className="text-sm font-extrabold text-ink mb-2">
          📍 발생 위치 <span className="text-[0.625rem] font-bold text-ink-muted">(지도 핀을 끌어 정확한 위치로 보정)</span>
        </h3>

        {/* 지도는 항상 표시 — GPS 미확인 시 기본 좌표 */}
        <div className="mb-2 relative">
          <LocationPickerMap
            lat={gps?.lat ?? DEFAULT_LAT}
            lng={gps?.lng ?? DEFAULT_LNG}
            onChange={onMapPinChange}
            height={220}
          />
          {!gps && (
            <div className="absolute top-2 left-2 right-2 px-3 py-1.5 rounded-md bg-amber-100/95 border border-amber-300 text-[0.6875rem] font-bold text-amber-900 backdrop-blur shadow-sm pointer-events-none">
              📍 위치 확인 중… 핀을 드래그해도 됩니다
            </div>
          )}
        </div>

        <div className="bg-surface-alt rounded-lg border border-line px-3 py-2 flex items-center gap-2 mb-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={gps ? 'text-success' : 'text-warn'}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1 text-[0.6875rem]">
            {gps ? (
              <span className="font-mono font-bold text-ink">{gps.lat.toFixed(5)}°N, {gps.lng.toFixed(5)}°E</span>
            ) : gpsErr ? (
              <span className="text-danger font-bold">{gpsErr}</span>
            ) : (
              <span className="text-ink-muted">위치 확인 중…</span>
            )}
          </div>
          <button onClick={pickGps} className="text-[0.625rem] font-mono font-extrabold px-2 py-1 rounded-md bg-surface border border-line active:scale-95">
            🎯 내 위치
          </button>
        </div>

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="상세 주소 (지도 클릭 시 자동 입력 · 수정 가능)"
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
        />
      </section>

      {/* 상세 내용 */}
      <section>
        <h3 className="text-sm font-extrabold text-ink mb-2">상세 내용 (선택)</h3>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="발생 상황을 자유롭게 적어 주세요"
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
        />
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs font-bold text-red-700">{error}</div>
      )}

      <button
        onClick={submit}
        disabled={busy || !type || !gps || !phone}
        className="w-full py-4 rounded-2xl bg-accent text-white text-base font-black shadow-card active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? '제출 중…' : '✈ 민원 신고 제출'}
      </button>

      <div className="text-[0.625rem] font-bold text-ink-faint leading-relaxed">
        ※ 본 신고는 즉시 담당 위탁업체로 전달되며, 처리 완료 시 알림을 드립니다 (특허 10-2024-0084638 청구항 4 흐름 S610~S650).
      </div>
    </div>
  );
}
