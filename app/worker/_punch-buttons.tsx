'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { hapticSuccess, hapticError, hapticLight } from '@/lib/haptics';

type GpsState =
  | { kind: 'idle' }
  | { kind: 'acquiring' }
  | { kind: 'ready'; lat: number; lng: number }
  | { kind: 'error'; message: string };

type PunchState = { checkInTime: string | null; checkOutTime: string | null };

export function PunchButtons({ workerName, initial }: { workerName: string; initial: PunchState }) {
  const router = useRouter();
  const toast = useToast();
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(initial);

  useEffect(() => { setState(initial); }, [initial]);

  useEffect(() => { requestGps(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function requestGps() {
    if (!('geolocation' in navigator)) {
      setGps({ kind: 'error', message: '위치 지원 안됨' });
      return;
    }
    hapticLight();
    setGps({ kind: 'acquiring' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ kind: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const msg = err.code === 1 ? '위치 권한 거부됨' : err.code === 3 ? '시간 초과' : '위치 오류';
        setGps({ kind: 'error', message: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  async function punch(action: 'check-in' | 'check-out') {
    if (gps.kind !== 'ready') {
      toast.warning('GPS 위치를 먼저 확인해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: gps.lat, lng: gps.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        hapticError();
        toast.error(translateError(data?.error, data) ?? '서버 오류');
        return;
      }
      hapticSuccess();
      toast.success(action === 'check-in' ? '출근 등록 완료' : '퇴근 등록 완료');
      setState((s) => ({
        checkInTime: data.record?.checkInTime ?? s.checkInTime,
        checkOutTime: data.record?.checkOutTime ?? s.checkOutTime,
      }));
      router.refresh();
    } catch {
      hapticError();
      toast.error('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  const checkedIn  = !!state.checkInTime;
  const checkedOut = !!state.checkOutTime;

  const gpsReady = gps.kind === 'ready';
  const gpsColor = gpsReady ? 'text-success' : gps.kind === 'error' ? 'text-danger' : 'text-warn';
  const gpsLabel = gps.kind === 'idle' ? 'GPS 대기' : gps.kind === 'acquiring' ? 'GPS 확인 중…' : gps.kind === 'ready' ? 'GPS 확인됨' : gps.message;

  return (
    <div className="space-y-2">
      {/* GPS 상태 표시 */}
      <div className="flex items-center justify-between px-1">
        <span className={`text-[0.6875rem] font-bold ${gpsColor}`}>
          {gps.kind === 'acquiring' ? '⏳ ' : gps.kind === 'ready' ? '✓ ' : gps.kind === 'error' ? '✗ ' : '○ '}
          {gpsLabel}
        </span>
        {gps.kind !== 'acquiring' && (
          <button
            onClick={requestGps}
            className="text-[0.6875rem] font-bold text-accent underline"
          >
            위치 재확인
          </button>
        )}
      </div>

      {/* 출근 / 퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => punch('check-in')}
          disabled={busy || checkedIn || !gpsReady}
          className="py-4 rounded-xl font-black text-base text-white shadow-md active:scale-[0.98] transition-all disabled:opacity-40 bg-success active:bg-green-700 flex flex-col items-center gap-1"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          <span>{busy ? '처리 중…' : checkedIn ? `출근 ${hm(state.checkInTime!)}` : '출근'}</span>
          {checkedIn && <span className="text-[0.625rem] font-semibold opacity-80">완료</span>}
        </button>

        <button
          onClick={() => punch('check-out')}
          disabled={busy || !checkedIn || checkedOut || !gpsReady}
          className="py-4 rounded-xl font-black text-base text-white shadow-md active:scale-[0.98] transition-all disabled:opacity-40 bg-info active:bg-blue-700 flex flex-col items-center gap-1"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>{busy ? '처리 중…' : checkedOut ? `퇴근 ${hm(state.checkOutTime!)}` : '퇴근'}</span>
          {checkedOut && <span className="text-[0.625rem] font-semibold opacity-80">완료</span>}
        </button>
      </div>

      {checkedIn && checkedOut && (
        <div className="text-center text-[0.6875rem] font-bold text-success">
          오늘 근무 완료 ✓  · 총 {workedDuration(state)}
        </div>
      )}
    </div>
  );
}

function hm(iso: string) {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

function workedDuration(s: PunchState) {
  if (!s.checkInTime || !s.checkOutTime) return '—';
  const ms = new Date(s.checkOutTime).getTime() - new Date(s.checkInTime).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function translateError(code?: string, data?: Record<string, unknown>): string | null {
  switch (code) {
    case 'already_checked_in':  return '이미 출근 등록되어 있습니다.';
    case 'already_checked_out': return '이미 퇴근 등록되어 있습니다.';
    case 'not_checked_in':      return '출근 기록이 없습니다.';
    case 'gps_out_of_range':    return 'GPS 좌표가 국내 범위를 벗어났습니다.';
    case 'punch_too_early':     return `출근 가능 시간이 아닙니다. ${data?.allowFrom ?? ''} 이후 시도해 주세요.`;
    case 'punch_too_late':      return `허용 시간이 지났습니다. ${data?.allowUntil ?? ''} 이전에 등록해 주세요.`;
    case 'outside_allowed_location': return `지정 장소(${data?.location ?? ''})에서만 등록 가능합니다.`;
    default: return null;
  }
}
