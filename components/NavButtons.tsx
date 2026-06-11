'use client';

/**
 * NavButtons — 민원 카드 / 경로 stop 에 부착하는 외부 내비 런처 버튼군.
 * - 첫 사용: 3개 버튼 동시 노출 (카카오맵/네이버지도/T맵)
 * - 클릭 시 해당 앱 자동 실행 + 선택을 localStorage 저장 (다음부터 1버튼)
 * - 항상 변경 가능 ("변경" 토글로 재노출)
 */
import { useEffect, useState } from 'react';
import { type NavApp, NAV_LABEL, launchNav, getPreferredNav, setPreferredNav, NAV_PREF_CHANGE_EVENT } from '@/lib/nav-launch';

type Props = {
  lat: number;
  lng: number;
  name?: string;
  /** 컴팩트 모드 — 작은 셀에 적합 (text-[0.625rem], py-1) */
  compact?: boolean;
  /** Phase 2: 클릭 시 자동 호출되는 백엔드 endpoint (예: /api/complaints/123/depart).
   *  sendBeacon 으로 비동기 전송 — 내비 앱 실행을 절대 막지 않음. */
  departEndpoint?: string;
};

const COLOR: Record<NavApp, string> = {
  kakaomap: 'bg-yellow-400 hover:bg-yellow-500 text-ink-muted',
  nmap: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  tmap: 'bg-rose-500 hover:bg-rose-600 text-white',
};

export default function NavButtons({ lat, lng, name = '민원지', compact = false, departEndpoint }: Props) {
  const [pref, setPref] = useState<NavApp | null>(null);
  const [showAll, setShowAll] = useState(false);
  /* 마운트 후에만 localStorage 접근 (SSR hydration mismatch 방지) */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPref(getPreferredNav());
    /* 설정 카드에서 선호 내비 변경 시 즉시 반영 (같은 탭 내) */
    function onPrefChange(e: Event) {
      const next = (e as CustomEvent<NavApp | null>).detail ?? null;
      setPref(next);
      if (next) setShowAll(false);
    }
    window.addEventListener(NAV_PREF_CHANGE_EVENT, onPrefChange);
    return () => window.removeEventListener(NAV_PREF_CHANGE_EVENT, onPrefChange);
  }, []);

  function fireDepart() {
    if (!departEndpoint || typeof navigator === 'undefined') return;
    /* Phase 2: 출동 timestamp 자동 기록.
       sendBeacon 사용 — 페이지 언로드/내비 앱 전환 직전에도 안정적 전송, 응답 무시. */
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(departEndpoint, blob);
      } else {
        /* fallback: keepalive fetch — 응답 기다리지 않음 */
        fetch(departEndpoint, { method: 'POST', keepalive: true }).catch(() => null);
      }
    } catch {
      /* 무시 — 내비 실행이 더 중요 */
    }
  }

  function go(app: NavApp) {
    setPreferredNav(app);
    setPref(app);
    setShowAll(false);
    fireDepart();
    launchNav(app, lat, lng, name);
  }

  /* 좌표 유효성 — lat/lng 0,0 또는 NaN 시 비활성 */
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  if (!valid) return null;

  /* SSR fallback — 마운트 전엔 3 버튼으로 표시 (서버=클라이언트 동일) */
  const showAllNow = !mounted || showAll || !pref;
  const sizeCls = compact
    ? 'px-1.5 py-1 text-[0.625rem]'
    : 'px-2.5 py-1.5 text-sm';

  if (!showAllNow && pref) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(pref)}
          className={`flex-1 rounded font-extrabold flex items-center justify-center gap-1 ${COLOR[pref]} ${sizeCls}`}
          aria-label={`${NAV_LABEL[pref]}로 길안내 시작`}
        >
          🧭 {NAV_LABEL[pref]} 길안내
        </button>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`rounded bg-slate-200 hover:bg-slate-300 text-ink-muted font-bold ${sizeCls}`}
          aria-label="내비 변경"
        >
          변경
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      <button
        type="button"
        onClick={() => go('kakaomap')}
        className={`rounded font-extrabold ${COLOR.kakaomap} ${sizeCls}`}
        aria-label="카카오맵으로 길안내"
      >
        카카오맵
      </button>
      <button
        type="button"
        onClick={() => go('nmap')}
        className={`rounded font-extrabold ${COLOR.nmap} ${sizeCls}`}
        aria-label="네이버지도로 길안내"
      >
        네이버지도
      </button>
      <button
        type="button"
        onClick={() => go('tmap')}
        className={`rounded font-extrabold ${COLOR.tmap} ${sizeCls}`}
        aria-label="T맵으로 길안내"
      >
        T맵
      </button>
    </div>
  );
}
