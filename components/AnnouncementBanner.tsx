'use client';

/**
 * 글로벌 공지 banner — 모든 인증 사용자에게 표시.
 * 30초 폴링 + 신규 공지 감지 시 사운드 + 진동 (사용자 요청 2026-05-01).
 *
 * - INFO/WARNING/CRITICAL 시각적 톤 차등
 * - 사용자가 dismiss 시 localStorage 에 ID 저장 → 재표시 안 함
 * - CRITICAL 은 dismiss 안 됨 (운영 중요 알림)
 */
import { useEffect, useState, useRef } from 'react';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  audience: string;
  pinned: boolean;
  publishedAt: string;
  authorName: string;
};

const SEV_TONE: Record<string, string> = {
  INFO:     'border-cyan-400 bg-cyan-50 text-cyan-900',
  WARNING:  'border-amber-400 bg-amber-50 text-amber-900',
  CRITICAL: 'border-rose-500 bg-rose-50 text-rose-900 animate-pulse',
};

const SEV_ICON: Record<string, string> = {
  INFO: '📘',
  WARNING: '⚠️',
  CRITICAL: '🚨',
};

const DISMISSED_KEY = 'cleanerp:dismissed-announcements';

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* 마운트 — dismissed 로드 + 사운드 객체 생성 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch { /* 무시 */ }
    /* 짧은 알림 사운드 — base64 비프 (외부 의존 0) */
    try {
      const beep = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' +
        'pvT19fX19fX18BBAAA///5/wAAAAD///nA==';
      audioRef.current = new Audio();
      audioRef.current.src = beep;
      audioRef.current.preload = 'auto';
    } catch { /* iOS 등 자동재생 차단 환경 무시 */ }
  }, []);

  /* 폴링 — 30초 마다 */
  useEffect(() => {
    let abort = false;
    async function fetchOnce() {
      try {
        const r = await fetch('/api/announcements');
        if (!r.ok) return;
        const j = await r.json();
        if (abort) return;
        const nextItems: Announcement[] = j.items ?? [];

        /* 신규 공지 감지 — 처음 mount 가 아닐 때만 알림 */
        if (seenIdsRef.current.size > 0) {
          const fresh = nextItems.filter((a) => !seenIdsRef.current.has(a.id));
          if (fresh.length > 0) {
            /* 사운드 + 진동 */
            try { audioRef.current?.play().catch(() => null); } catch { /* */ }
            try {
              if ('vibrate' in navigator) {
                /* 신규 공지 알림 — 짧게 두 번 */
                navigator.vibrate?.([200, 100, 200]);
              }
            } catch { /* */ }
            /* 브라우저 Notification (권한 있을 때만) */
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              fresh.slice(0, 3).forEach((a) => {
                try {
                  new Notification(`📢 ${a.title}`, {
                    body: a.body.slice(0, 100),
                    icon: '/icons/icon-192.png',
                    tag: `announcement-${a.id}`,
                  });
                } catch { /* */ }
              });
            }
          }
        }
        nextItems.forEach((a) => seenIdsRef.current.add(a.id));
        setItems(nextItems);
      } catch { /* 무시 */ }
    }
    fetchOnce();
    const t = setInterval(fetchOnce, 30_000);
    return () => { abort = true; clearInterval(t); };
  }, []);

  /* 권한 요청 — 사용자 첫 클릭 시 */
  function requestNotifPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => null);
    }
  }
  useEffect(() => {
    /* 첫 사용자 클릭으로 권한 요청 */
    const onClick = () => {
      requestNotifPermission();
      window.removeEventListener('click', onClick);
    };
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next))); } catch { /* */ }
  }

  /* CRITICAL은 dismiss 무시, 나머지는 dismissed 필터 */
  const visible = items.filter((a) => a.severity === 'CRITICAL' || !dismissed.has(a.id));
  if (visible.length === 0) return null;

  /* CRITICAL 우선 노출 */
  visible.sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (order[a.severity] - order[b.severity]) || (a.pinned ? -1 : 1);
  });

  const top = visible[0];
  const more = visible.length - 1;

  return (
    <div className="relative">
      <div className={`border-l-4 px-3 py-2 ${SEV_TONE[top.severity]}`}>
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">{SEV_ICON[top.severity]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-sm">{top.title}</div>
            {expanded && (
              <div className="text-xs mt-1 whitespace-pre-wrap leading-relaxed">{top.body}</div>
            )}
            {!expanded && (
              <div className="text-xs mt-0.5 truncate">{top.body}</div>
            )}
            <div className="text-[0.625rem] font-mono mt-1 opacity-70">
              {top.authorName} · {new Date(top.publishedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {more > 0 && ` · 외 ${more}건`}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={() => setExpanded((v) => !v)} className="text-xs font-bold px-2 py-0.5 rounded bg-white/60 hover:bg-white">
              {expanded ? '접기' : '자세히'}
            </button>
            {top.severity !== 'CRITICAL' && (
              <button onClick={() => dismiss(top.id)} aria-label="공지 닫기" className="text-xs font-bold px-2 py-0.5 rounded bg-white/60 hover:bg-white">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
