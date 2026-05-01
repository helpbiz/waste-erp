'use client';

/**
 * 신규 민원 도착 음성 알림 — AnnouncementBanner 와 동일한 폴링 패턴.
 *
 * - 30 초 폴링 → /api/complaints?limit=30&status=
 * - 새로 등장한 complaint id 가 있으면:
 *     · 사운드(short beep) + 진동
 *     · TTS: "{회사|지자체}에서 새로운 민원이 접수되었습니다."
 *           → reporter.role === 'MUNI_ADMIN' → 지자체 / else → 회사
 *     · OS Notification (granted 시)
 *
 * - 첫 fetch 는 음소거 (기존 데이터 학습 단계)
 *
 * 마운트 위치: admin shell + worker shell layout (AnnouncementBanner 와 함께)
 */
import { useEffect, useRef } from 'react';
import { loadVoiceSettings, speakComplaintArrival } from '@/lib/voice-settings';

type ComplaintItem = {
  id: string;
  type: string;
  status: string;
  reportedAt: string;
  locationAddress: string | null;
  reporter: { id: string; name: string; role?: string | null } | null;
};

export default function ComplaintBanner() {
  const seenRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    /* 가벼운 beep — base64 wav 헤더만 (silence 가 사실상) */
    try {
      const beep = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' +
        'pvT19fX19fX18BBAAA///5/wAAAAD///nA==';
      audioRef.current = new Audio(beep);
      audioRef.current.preload = 'auto';
    } catch { /* */ }

    let abort = false;

    async function fetchOnce() {
      try {
        const r = await fetch('/api/complaints?limit=30');
        if (!r.ok) return;
        const j = await r.json() as { items?: ComplaintItem[] };
        if (abort) return;

        const items = j.items ?? [];
        const isFirst = !initializedRef.current;

        if (isFirst) {
          /* 학습 — 기존 항목은 모두 seen 처리, 알림 없음 */
          items.forEach((c) => seenRef.current.add(c.id));
          initializedRef.current = true;
          return;
        }

        const fresh = items.filter((c) => !seenRef.current.has(c.id));
        if (fresh.length === 0) return;

        /* 가장 최근 신규 complaint 1건 기준 발화 */
        const top = fresh[0];
        const reporterRole = top.reporter?.role ?? null;

        try { audioRef.current?.play().catch(() => null); } catch { /* */ }
        try { navigator.vibrate?.([150, 80, 150]); } catch { /* */ }
        try {
          const settings = loadVoiceSettings();
          speakComplaintArrival(reporterRole, settings);
        } catch { /* */ }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          fresh.slice(0, 3).forEach((c) => {
            try {
              const who = c.reporter?.role === 'MUNI_ADMIN' ? '지자체' : '회사';
              new Notification(`🚨 새 민원 접수 (${who})`, {
                body: `${c.locationAddress ?? '위치 정보 없음'}`,
                icon: '/icons/icon-192.png',
                tag: `complaint-${c.id}`,
              });
            } catch { /* */ }
          });
        }

        items.forEach((c) => seenRef.current.add(c.id));
      } catch { /* */ }
    }

    fetchOnce();
    const t = setInterval(fetchOnce, 30_000);
    return () => { abort = true; clearInterval(t); };
  }, []);

  return null;
}
