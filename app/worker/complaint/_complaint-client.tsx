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
    <div className="h-[200px] rounded-lg border-2 border-line bg-surface-soft flex items-center justify-center text-sm font-mono text-ink-muted">
      🗺️ 지도 로딩 중…
    </div>
  ),
});

/* GPS 미확인 시 기본 지도 중심 — 서울시청 (사용자가 핀을 드래그하여 보정) */
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;

type Type = 'PICKUP_MISS' | 'ILLEGAL_DUMP' | 'ODOR_NOISE' | 'BULKY_WASTE' | 'OTHER';

type GpsState =
  | { kind: 'idle' }
  | { kind: 'acquiring' }
  | { kind: 'ready'; lat: number; lng: number }
  | { kind: 'error'; message: string };

const TYPES: { id: Type; label: string; color: string }[] = [
  { id: 'PICKUP_MISS',  label: '수거 미비',   color: 'bg-red-100 text-danger border-red-200' },
  { id: 'ILLEGAL_DUMP', label: '불법투기',     color: 'bg-amber-100 text-warn border-amber-200' },
  { id: 'ODOR_NOISE',   label: '악취/소음',   color: 'bg-blue-100 text-info border-blue-200' },
  { id: 'BULKY_WASTE',  label: '대형폐기물',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'OTHER',        label: '기타',         color: 'bg-slate-100 text-ink-muted border-slate-200' },
];

export default function ComplaintClient({ coworkers = [] }: { coworkers?: { id: string; name: string }[] }) {
  /* 사용자 요청 2026-05-02: 탭 구조 — 내 민원 처리 + 신규 등록.
     기본은 'register' (지도 즉시 가시); inbox 활성건이 있으면 뱃지 표시. */
  const [tab, setTab] = useState<'inbox' | 'register'>('register');
  const [inboxActiveCount, setInboxActiveCount] = useState<number>(0);

  /* 첫 mount 에 inbox 활성 카운트만 가볍게 fetch — N>0 면 뱃지 노출 */
  useEffect(() => {
    let abort = false;
    fetch('/api/complaints?limit=50')
      .then((r) => r.ok ? r.json() : null)
      .then((j: { items?: { status: string }[] } | null) => {
        if (abort || !j?.items) return;
        const active = j.items.filter((c) => ['ASSIGNED', 'IN_PROGRESS', 'RECEIVED'].includes(c.status)).length;
        setInboxActiveCount(active);
      })
      .catch(() => null);
    return () => { abort = true; };
  }, []);
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<Type | null>(null);
  const [locationMode, setLocationMode] = useState<'map' | 'text'>('map');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>('');

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
      if (assigneeId) body.assigneeId = assigneeId;
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
      setAssigneeId('');
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
      {/* 탭 — 기본 'inbox' (배정받은 민원 처리) */}
      <div className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card">
        <button
          onClick={() => setTab('inbox')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-extrabold transition relative ${
            tab === 'inbox' ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'
          }`}
        >
          📥 내 민원
          {inboxActiveCount > 0 && (
            <span
              className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[0.625rem] font-mono font-extrabold ${
                tab === 'inbox' ? 'bg-white text-accent' : 'bg-rose-500 text-white'
              }`}
              aria-label={`처리 가능 ${inboxActiveCount}건`}
            >
              {inboxActiveCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('register')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-extrabold transition ${
            tab === 'register' ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'
          }`}
        >
          ✏ 신규 등록
        </button>
      </div>

      {tab === 'inbox' && <InboxPanel coworkers={coworkers} />}

      {tab === 'register' && (
      <>
      <div className="px-1">
        <h1 className="text-xl font-black text-ink">민원 등록</h1>
        <p className="text-sm font-bold text-ink-muted mt-1">현장에서 발견한 민원을 등록합니다.</p>
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

      <Section label="발생 위치">
        {/* 위치 입력 방식 전환 */}
        <div className="flex gap-1 bg-surface-soft border border-line rounded-lg p-1 mb-3">
          <button
            type="button"
            onClick={() => { setLocationMode('map'); requestGps(); }}
            className={`flex-1 py-1.5 rounded text-sm font-extrabold transition ${locationMode === 'map' ? 'bg-white shadow text-accent' : 'text-ink-muted'}`}
          >
            🗺 지도 선택
          </button>
          <button
            type="button"
            onClick={() => { setLocationMode('text'); setGps({ kind: 'idle' }); setAddress(''); }}
            className={`flex-1 py-1.5 rounded text-sm font-extrabold transition ${locationMode === 'text' ? 'bg-white shadow text-accent' : 'text-ink-muted'}`}
          >
            ✏ 주소 직접 입력
          </button>
        </div>

        {locationMode === 'map' && (
          <>
            {/* 지도 — GPS 미확인 시 기본 좌표(서울시청) */}
            <div className="mb-2 relative">
              <LocationPickerMap
                lat={gps.kind === 'ready' ? gps.lat : DEFAULT_LAT}
                lng={gps.kind === 'ready' ? gps.lng : DEFAULT_LNG}
                onChange={onMapPinChange}
                height={200}
              />
              {gps.kind !== 'ready' && (
                <div className="absolute top-2 left-2 right-2 px-3 py-1.5 rounded-md bg-amber-100/95 border border-amber-300 text-sm font-bold text-amber-900 backdrop-blur shadow-sm pointer-events-none">
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
              <div className="flex-1 text-sm">
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
                className="text-sm font-mono font-extrabold px-2 py-1 rounded-md bg-surface border border-line active:scale-95"
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
              className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
            />
          </>
        )}

        {locationMode === 'text' && (
          <div className="space-y-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울시 용산구 한강대로 1길 23"
              className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
              autoFocus
            />
            <p className="text-[0.625rem] text-ink-faint font-mono px-1">
              도로명 또는 지번 주소를 직접 입력하세요. 좌표는 자동으로 조회됩니다.
            </p>
          </div>
        )}
      </Section>

      <Section label="신고 내용 (선택)">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="현장 상황 / 신고 내용"
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent resize-none"
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
          className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-mono font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
        />
      </Section>

      <Section label="현장 사진 (최대 3장 · 카메라 직촬 가능)">
        <MultiPhotoUploader onChange={setPhotos} max={3} />
      </Section>

      {coworkers.length > 0 && (
        <Section label="담당자 지정 (선택 — 미선택 시 자동 배정)">
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
          >
            <option value="">— 자동 배정 —</option>
            {coworkers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Section>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !type}
        className="w-full py-4 rounded-2xl bg-warn text-white text-base font-black shadow-card active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {busy ? '등록 중…' : '민원 등록'}
      </button>

      {/* 인라인 에러 배너 → Toast (Wave 3-D) */}
      </>
      )}
    </div>
  );
}

/* ─────────── InboxPanel — 자기 배정 민원 처리 (사용자 요청 2026-05-02) ─────────── */

type InboxComplaint = {
  id: string;
  type: string;
  status: string;
  description: string | null;
  reportedAt: string;
  locationAddress: string | null;
  zoneName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  complainantPhone: string | null;
  requestImage: string | null;
  completionImage: string | null;
  resolveNote: string | null;
  resolvedAt: string | null;
  assignee: { id: string; name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수', ASSIGNED: '배정', IN_PROGRESS: '처리중', COMPLETED: '완료', REJECTED: '반려',
};
const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음', BULKY_WASTE: '대형폐기물', OTHER: '기타',
};

function InboxPanel({ coworkers = [] }: { coworkers?: { id: string; name: string }[] }) {
  const toast = useToast();
  const [items, setItems] = useState<InboxComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completeModal, setCompleteModal] = useState<{ id: string; mode: 'complete' | 'reject' } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/complaints?limit=50')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function action(id: string, endpoint: 'start' | 'arrive', label: string) {
    setBusyId(id);
    const r = await fetch(`/api/complaints/${id}/${endpoint}`, { method: 'POST' });
    setBusyId(null);
    if (r.ok) {
      toast.success(`${label} 기록됨`);
      load();
    } else {
      const j = await r.json().catch(() => ({}));
      toast.error(`실패: ${j.error ?? 'unknown'}`);
    }
  }

  const filtered = items.filter((c) => {
    if (filter === 'active') return c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || c.status === 'RECEIVED';
    if (filter === 'completed') return c.status === 'COMPLETED' || c.status === 'REJECTED';
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-xl font-black text-ink">📥 내 민원 처리</h1>
        <p className="text-sm font-bold text-ink-muted mt-1">배정받은 민원의 도착·처리 시작·완료·반려를 기록합니다.</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5">
        <FilterBtn active={filter === 'active'} onClick={() => setFilter('active')}>처리 중 ({items.filter(c => c.status !== 'COMPLETED' && c.status !== 'REJECTED').length})</FilterBtn>
        <FilterBtn active={filter === 'completed'} onClick={() => setFilter('completed')}>완료/반려</FilterBtn>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>전체</FilterBtn>
      </div>

      {loading && <div className="py-10 text-center text-ink-faint text-sm">로딩 중…</div>}
      {!loading && filtered.length === 0 && (
        <div className="bg-surface border border-line rounded-xl py-12 text-center text-sm text-ink-faint font-bold">
          {filter === 'active' ? '🎉 처리 중인 민원 없음' : '결과 없음'}
        </div>
      )}

      {filtered.map((c) => {
        const isActive = c.status !== 'COMPLETED' && c.status !== 'REJECTED';
        return (
          <article key={c.id} className={`bg-surface border-2 rounded-xl shadow-card overflow-hidden ${
            c.isOverdue ? 'border-rose-400' : 'border-line'
          }`}>
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-sm font-extrabold text-ink">{TYPE_LABEL[c.type] ?? c.type}</span>
                <span className={`text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full border ${
                  c.status === 'IN_PROGRESS' ? 'bg-cyan-100 text-cyan-800 border-cyan-300' :
                  c.status === 'COMPLETED'   ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  c.status === 'REJECTED'    ? 'bg-slate-200 text-ink-muted border-slate-400' :
                  c.status === 'ASSIGNED'    ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                                'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {STATUS_LABEL[c.status]}
                </span>
                {c.isOverdue && <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">⚠ 기한 초과</span>}
                <code className="ml-auto text-[0.625rem] font-mono text-ink-faint">#{c.id}</code>
              </div>
              {c.locationAddress && (
                <div className="text-sm text-ink font-semibold leading-snug">📍 {c.locationAddress}</div>
              )}
              {c.description && (
                <div className="text-sm text-ink-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">{c.description}</div>
              )}
              {c.complainantPhone && (
                <div className="text-sm text-ink-muted mt-1">📞 {c.complainantPhone}</div>
              )}
              {c.assignee && (
                <div className="text-sm text-ink-faint mt-1">담당: <span className="font-bold">{c.assignee.name}</span></div>
              )}
              {(parseImages(c.requestImage).length > 0 || parseImages(c.completionImage).length > 0) && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {parseImages(c.requestImage).map((src, i) => (
                    <button key={`req-${i}`} onClick={() => setLightboxSrc(src)} className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`민원사진${i + 1}`} className="h-16 w-16 object-cover rounded-md border border-line" />
                    </button>
                  ))}
                  {parseImages(c.completionImage).map((src, i) => (
                    <button key={`cmp-${i}`} onClick={() => setLightboxSrc(src)} className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`완료사진${i + 1}`} className="h-16 w-16 object-cover rounded-md border-2 border-emerald-400" />
                    </button>
                  ))}
                </div>
              )}
              {c.resolveNote && (
                <div className="mt-2 px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 whitespace-pre-wrap">
                  ✓ {c.resolveNote}
                </div>
              )}
              <div className="text-[0.625rem] font-mono text-ink-faint mt-2">
                접수: {new Date(c.reportedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {c.resolvedAt && ` · 완료: ${new Date(c.resolvedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                {c.dueDate && ` · 마감: ${new Date(c.dueDate).toLocaleDateString('ko-KR')}`}
                {c.zoneName && ` · ${c.zoneName}`}
              </div>
            </div>

            {/* 처리 액션 — 활성 민원만 */}
            {isActive && (
              <div className="px-4 py-2.5 bg-surface-soft border-t border-line flex flex-wrap gap-1.5">
                {(c.status === 'ASSIGNED' || c.status === 'RECEIVED') && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, 'start', '처리 시작')}
                    className="px-3 py-2 rounded-lg text-sm font-extrabold bg-cyan-600 hover:bg-cyan-700 text-white active:scale-95 disabled:opacity-50 min-h-[40px]"
                  >
                    ▶ 처리 시작
                  </button>
                )}
                <button
                  disabled={busyId === c.id}
                  onClick={() => action(c.id, 'arrive', '도착')}
                  className="px-3 py-2 rounded-lg text-sm font-extrabold bg-purple-600 hover:bg-purple-700 text-white active:scale-95 disabled:opacity-50 min-h-[40px]"
                >
                  📍 도착 확인
                </button>
                <button
                  disabled={busyId === c.id}
                  onClick={() => setCompleteModal({ id: c.id, mode: 'complete' })}
                  className="px-3 py-2 rounded-lg text-sm font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 disabled:opacity-50 min-h-[40px]"
                >
                  ✓ 처리 완료
                </button>
                <button
                  disabled={busyId === c.id}
                  onClick={() => setCompleteModal({ id: c.id, mode: 'reject' })}
                  className="ml-auto px-3 py-2 rounded-lg text-sm font-extrabold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 disabled:opacity-50 min-h-[40px]"
                >
                  ✕ 반려
                </button>
              </div>
            )}
          </article>
        );
      })}

      {completeModal && (
        <CompleteModal
          {...completeModal}
          coworkers={coworkers}
          onClose={() => setCompleteModal(null)}
          onDone={() => { setCompleteModal(null); load(); }}
        />
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center px-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold leading-none"
            aria-label="닫기"
          >&times;</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="사진 크게 보기"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-sm font-extrabold transition ${
      active ? 'bg-accent text-white' : 'bg-slate-100 text-ink-muted hover:bg-slate-200'
    }`}>
      {children}
    </button>
  );
}

function CompleteModal({
  id, mode, coworkers, onClose, onDone,
}: {
  id: string;
  mode: 'complete' | 'reject';
  coworkers: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [taggedUserId, setTaggedUserId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const taggedName = coworkers.find((w) => w.id === taggedUserId)?.name ?? '';

  async function submit() {
    if (mode === 'reject' && note.trim().length < 2) {
      toast.error('반려 사유를 2자 이상 입력하세요');
      return;
    }
    setBusy(true);
    const displayNote = taggedName
      ? `${note.trim()} → @${taggedName} 알림`
      : note.trim();
    const body: Record<string, unknown> = { note: displayNote };
    if (mode === 'complete') {
      if (taggedUserId) body.taggedUserId = taggedUserId;
      if (photos.length > 0) body.requestImages = photos;
    }
    const endpoint = mode === 'complete' ? 'complete' : 'reject';
    const r = await fetch(`/api/complaints/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (r.ok) {
      toast.success(mode === 'complete' ? '처리 완료' : '반려 처리됨');
      onDone();
    } else {
      const j = await r.json().catch(() => ({}));
      toast.error(`실패: ${j.error ?? 'unknown'}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[480px] w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-base font-black text-ink">
            {mode === 'complete' ? '✓ 처리 완료' : '✕ 반려'} (#{id})
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-sm font-extrabold text-ink mb-1">
              {mode === 'complete' ? '처리 내용 (선택)' : '반려 사유 (필수)'}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={mode === 'complete' ? '예: 청소 완료' : '예: 중복 신고, 관할 외 위치'}
              className="w-full px-3 py-2 rounded border-2 border-line text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
            />
          </div>

          {mode === 'complete' && (
            <>
              {/* 완료 사진 최대 3장 */}
              <div>
                <div className="text-sm font-extrabold text-ink mb-1">완료 사진 (선택, 최대 3장)</div>
                <MultiPhotoUploader onChange={setPhotos} max={3} />
              </div>

              {/* 담당자 태그 */}
              {coworkers.length > 0 && (
                <div>
                  <div className="text-sm font-extrabold text-ink mb-1">
                    담당자 태그 (선택 — 알림 발송)
                  </div>
                  <select
                    value={taggedUserId}
                    onChange={(e) => setTaggedUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                  >
                    <option value="">— 태그 없음 —</option>
                    {coworkers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  {taggedName && (
                    <p className="text-[0.6875rem] text-accent mt-1">
                      ✓ {taggedName}님의 공지사항에 알림이 전송됩니다.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 rounded border border-line text-sm font-bold">취소</button>
          <button onClick={submit} disabled={busy} className={`px-4 py-1.5 rounded text-white text-sm font-extrabold disabled:opacity-50 ${
            mode === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
          }`}>
            {busy ? '처리 중…' : mode === 'complete' ? '✓ 완료' : '✕ 반려'}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch { /* not JSON — single data URL */ }
  return [raw];
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-extrabold text-ink mb-2 tracking-wide">{label}</div>
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
