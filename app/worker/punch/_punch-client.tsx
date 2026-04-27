'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Initial = {
  checkInTime: string | null;
  checkOutTime: string | null;
  zoneName: string | null;
};

type GpsState =
  | { kind: 'idle' }
  | { kind: 'acquiring' }
  | { kind: 'ready'; lat: number; lng: number; accuracy: number }
  | { kind: 'error'; message: string };

export default function PunchClient({ initial, workerName }: { initial: Initial; workerName: string }) {
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(initial);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* 페이지 진입 시 GPS 자동 획득 */
  useEffect(() => {
    requestGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestGps() {
    if (!('geolocation' in navigator)) {
      setGps({ kind: 'error', message: '이 브라우저는 위치 정보를 지원하지 않습니다.' });
      return;
    }
    setGps({ kind: 'acquiring' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          kind: 'ready',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGps({
          kind: 'error',
          message:
            err.code === 1
              ? '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.'
              : err.code === 2
              ? '위치를 확인할 수 없습니다 (GPS 신호 약함).'
              : err.code === 3
              ? '위치 확인 시간이 초과되었습니다.'
              : '위치 확인 중 오류가 발생했습니다.',
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  const checkedIn = !!state.checkInTime;
  const checkedOut = !!state.checkOutTime;
  const phase: 'before-in' | 'before-out' | 'done' = !checkedIn ? 'before-in' : !checkedOut ? 'before-out' : 'done';

  async function punch() {
    if (gps.kind !== 'ready') {
      setError('GPS 위치를 먼저 확인해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = phase === 'before-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const body: Record<string, number> = { lat: gps.lat, lng: gps.lng };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(translate(data?.error) ?? '서버 오류가 발생했습니다.');
        return;
      }
      setState((s) => ({
        ...s,
        checkInTime: data.record?.checkInTime ?? s.checkInTime,
        checkOutTime: data.record?.checkOutTime ?? s.checkOutTime,
      }));
      router.refresh(); // 서버 컴포넌트(홈) 동기화
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-ink">출퇴근 등록</h1>
        <div className="font-mono text-sm font-bold text-ink-muted mt-1">{fmtClock(now)}</div>
      </div>

      {/* 상태 카드 */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-5">
        <div className="grid grid-cols-2 gap-3">
          <Box label="출근">
            {state.checkInTime ? (
              <span className="font-mono text-2xl font-black text-success">{hm(state.checkInTime)}</span>
            ) : (
              <span className="font-mono text-xl font-extrabold text-ink-muted">—</span>
            )}
          </Box>
          <Box label="퇴근">
            {state.checkOutTime ? (
              <span className="font-mono text-2xl font-black text-info">{hm(state.checkOutTime)}</span>
            ) : (
              <span className="font-mono text-xl font-extrabold text-ink-muted">—</span>
            )}
          </Box>
        </div>
        {state.zoneName && (
          <div className="mt-4 pt-3 border-t border-line text-xs font-bold text-ink-muted">
            담당 구역 · <span className="text-ink font-extrabold">{state.zoneName}</span>
          </div>
        )}
      </div>

      {/* GPS 상태 */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              gps.kind === 'ready' ? 'bg-green-100' : gps.kind === 'error' ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              className={gps.kind === 'ready' ? 'text-success' : gps.kind === 'error' ? 'text-danger' : 'text-warn'}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-ink">
              {gps.kind === 'idle' && 'GPS 위치 확인 대기'}
              {gps.kind === 'acquiring' && 'GPS 위치 확인 중…'}
              {gps.kind === 'ready' && '위치 확인 완료'}
              {gps.kind === 'error' && '위치 확인 실패'}
            </div>
            {gps.kind === 'ready' && (
              <div className="font-mono text-xs text-ink-muted font-bold mt-1">
                {gps.lat.toFixed(5)}°N, {gps.lng.toFixed(5)}°E · 정확도 ±{Math.round(gps.accuracy)}m
              </div>
            )}
            {gps.kind === 'error' && <div className="text-xs text-danger font-bold mt-1">{gps.message}</div>}
          </div>
          <button
            onClick={requestGps}
            disabled={gps.kind === 'acquiring'}
            className="px-3 py-1.5 rounded-md border border-line text-xs font-extrabold text-ink hover:bg-surface-soft active:scale-95 transition disabled:opacity-50"
          >
            ↻ 재시도
          </button>
        </div>
      </div>

      {/* 큰 액션 버튼 */}
      {phase !== 'done' ? (
        <button
          onClick={punch}
          disabled={busy || gps.kind !== 'ready'}
          className={`w-full py-6 rounded-2xl text-white text-xl font-black shadow-card transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
            phase === 'before-in' ? 'bg-success hover:bg-green-700' : 'bg-info hover:bg-blue-700'
          }`}
        >
          {busy
            ? '처리 중…'
            : phase === 'before-in'
            ? `${workerName}님, 출근 등록`
            : `${workerName}님, 퇴근 등록`}
        </button>
      ) : (
        <div className="bg-green-50 border border-green-300 border-l-4 border-l-success rounded-xl px-5 py-4 text-center">
          <div className="text-base font-extrabold text-success">오늘 근무 완료 ✓</div>
          <div className="text-xs font-bold text-ink-muted mt-1">총 {workedDuration(state)} 근무하셨습니다.</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
        <strong className="font-extrabold">출퇴근 등록 안내</strong> · 출근 시각은 자동으로 KST 기준 저장됩니다. 06:00 이후 출근은 지각으로 분류되며, 관리자 조정 후 임금이 반영됩니다.
      </div>
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-alt rounded-lg border border-line p-3 text-center">
      <div className="text-[11px] font-extrabold text-ink-muted tracking-widest mb-1">{label}</div>
      {children}
    </div>
  );
}

function fmtClock(d: Date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${days[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hm(iso: string) {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

function workedDuration(s: { checkInTime: string | null; checkOutTime: string | null }) {
  if (!s.checkInTime || !s.checkOutTime) return '—';
  const ms = new Date(s.checkOutTime).getTime() - new Date(s.checkInTime).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function translate(code?: string): string | null {
  switch (code) {
    case 'gps_out_of_range': return 'GPS 좌표가 국내 범위를 벗어났습니다.';
    case 'already_checked_in': return '이미 출근 등록되어 있습니다.';
    case 'already_checked_out': return '이미 퇴근 등록되어 있습니다.';
    case 'not_checked_in': return '출근 기록이 없습니다.';
    case 'no_contractor_assigned': return '소속 위탁업체가 지정되지 않았습니다. 관리자에게 문의해 주세요.';
    case 'workers_only': return '근로자 계정만 출퇴근을 등록할 수 있습니다.';
    case 'unauthenticated': return '로그인이 만료되었습니다.';
    case 'invalid_request': return '요청 형식이 올바르지 않습니다.';
    default: return null;
  }
}
