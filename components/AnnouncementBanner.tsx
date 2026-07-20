'use client';

/**
 * 공지사항 자동 팝업 — 접속 즉시 미확인 공지를 모달로 표시 (사용자 요청 2026-05-02).
 *
 * - 페이지 mount → 1초 후 미확인 공지 fetch → 있으면 모달 자동 오픈
 * - 사운드 + 진동 + Notification API
 * - 30초 폴링 — 신규 공지 발생 시 popup 다시 노출
 * - CRITICAL 은 dismiss 안 됨 (확인 강제)
 * - INFO/WARNING 은 [확인] 으로 서버(AnnouncementRead)에 읽음 기록 — 기기/브라우저 무관하게 영구 보존.
 *   확인한 공지는 다시 뜨지 않고, 새 공지가 등록됐을 때만 재노출된다.
 */
import { useEffect, useRef, useState } from 'react';
import { loadVoiceSettings, speakAnnouncement } from '@/lib/voice-settings';
import VoiceSettingsModal from '@/components/VoiceSettingsModal';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  audience: string;
  pinned: boolean;
  publishedAt: string;
  authorName: string;
  authorRole?: string | null;
  readByMe: boolean;
};

const SEV_TONE: Record<string, string> = {
  INFO:     'border-cyan-400 bg-cyan-50 text-cyan-900',
  WARNING:  'border-amber-400 bg-amber-50 text-amber-900',
  CRITICAL: 'border-rose-500 bg-rose-50 text-rose-900',
};

const SEV_ICON: Record<string, string> = {
  INFO: '📘',
  WARNING: '⚠️',
  CRITICAL: '🚨',
};

const SEV_LABEL: Record<string, string> = {
  INFO: '안내',
  WARNING: '주의',
  CRITICAL: '긴급',
};

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* 마운트 — 사운드 객체 + 첫 fetch */
  useEffect(() => {
    setMounted(true);
    try {
      const beep = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' +
        'pvT19fX19fX18BBAAA///5/wAAAAD///nA==';
      audioRef.current = new Audio();
      audioRef.current.src = beep;
      audioRef.current.preload = 'auto';
    } catch { /* */ }
  }, []);

  /* 폴링 — 30초 마다 + 첫 mount 시 즉시 */
  useEffect(() => {
    if (!mounted) return;
    let abort = false;

    async function fetchOnce() {
      try {
        const r = await fetch('/api/announcements');
        if (!r.ok) return;
        const j = await r.json();
        if (abort) return;
        const nextItems: Announcement[] = j.items ?? [];

        /* 신규 공지 감지 — 처음 mount 가 아닐 때 사운드+진동 */
        const isFirstFetch = seenIdsRef.current.size === 0;
        if (!isFirstFetch) {
          const fresh = nextItems.filter((a) => !seenIdsRef.current.has(a.id));
          if (fresh.length > 0) {
            try { audioRef.current?.play().catch(() => null); } catch { /* */ }
            try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
            /* TTS — 가장 최신 신규 공지의 author role 기준으로 발화 */
            try {
              const voiceSettings = loadVoiceSettings();
              const top = fresh[0];
              speakAnnouncement(top?.authorRole, voiceSettings);
            } catch { /* */ }
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
            /* 신규 공지 발생 → popup 다시 오픈 */
            setPopupOpen(true);
          }
        } else {
          /* 첫 fetch — 미확인 공지 1개 이상이면 popup 자동 오픈 */
          const visible = nextItems.filter((a) => a.severity === 'CRITICAL' || !a.readByMe);
          if (visible.length > 0) {
            /* 사운드 1회 재생 — 사용자 환영 */
            setTimeout(() => {
              try { audioRef.current?.play().catch(() => null); } catch { /* */ }
              try { navigator.vibrate?.(150); } catch { /* */ }
              /* TTS — 가장 우선순위 높은 미확인 공지(이미 정렬된 첫 항목) author role */
              try {
                const voiceSettings = loadVoiceSettings();
                const top = visible[0];
                speakAnnouncement(top?.authorRole, voiceSettings);
              } catch { /* */ }
            }, 1200);
            setPopupOpen(true);
          }
        }

        nextItems.forEach((a) => seenIdsRef.current.add(a.id));
        setItems(nextItems);
      } catch { /* */ }
    }

    fetchOnce();
    const t = setInterval(fetchOnce, 30_000);
    return () => { abort = true; clearInterval(t); };
  }, [mounted]);

  /* Notification 권한 — 첫 사용자 클릭 시 */
  useEffect(() => {
    const onClick = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => null);
      }
      window.removeEventListener('click', onClick);
    };
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  function dismissOne(id: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, readByMe: true } : a)));
    fetch(`/api/announcements/${id}/read`, { method: 'POST' }).catch(() => {});
  }

  function confirmAll() {
    const targets = visible.filter((a) => a.severity !== 'CRITICAL');
    const ids = new Set(targets.map((a) => a.id));
    setItems((prev) => prev.map((a) => (ids.has(a.id) ? { ...a, readByMe: true } : a)));
    targets.forEach((a) => {
      fetch(`/api/announcements/${a.id}/read`, { method: 'POST' }).catch(() => {});
    });
    /* CRITICAL 만 남았는지 확인 */
    const stillCritical = visible.some((a) => a.severity === 'CRITICAL');
    if (!stillCritical) setPopupOpen(false);
  }

  /* 표시 대상 계산 */
  const visible = items.filter((a) => a.severity === 'CRITICAL' || !a.readByMe);

  /* CRITICAL 우선 정렬 */
  visible.sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  if (!popupOpen || visible.length === 0) {
    /* 팝업이 닫혀 있어도 음성 설정 모달은 단독 노출 가능해야 함 */
    return voiceOpen ? <VoiceSettingsModal onClose={() => setVoiceOpen(false)} /> : null;
  }

  const hasCritical = visible.some((a) => a.severity === 'CRITICAL');

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3"
      onClick={(e) => {
        /* 외부 클릭 — CRITICAL 없을 때만 닫기 (단, dismiss 는 안 함 → 다음 폴링 시 다시 뜸) */
        if (e.target === e.currentTarget && !hasCritical) {
          setPopupOpen(false);
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-[640px] w-full max-h-[88vh] flex flex-col animate-popup-in">
        {/* Header */}
        <div className="px-5 py-3 border-b border-line bg-purple-50 flex items-center gap-2">
          <span className="text-xl">📢</span>
          <h2 className="text-base font-black text-ink flex-1">공지사항 ({visible.length}건)</h2>
          <button
            onClick={() => setVoiceOpen(true)}
            aria-label="음성 알림 설정"
            title="음성 알림 설정"
            className="px-2 py-1 rounded text-sm font-extrabold bg-white/80 border border-purple-200 hover:bg-white active:scale-95"
          >
            🔊 음성
          </button>
          {!hasCritical && (
            <button onClick={() => setPopupOpen(false)} aria-label="닫기" className="text-ink-faint hover:text-ink-muted text-xl leading-none">✕</button>
          )}
        </div>

        {voiceOpen && <VoiceSettingsModal onClose={() => setVoiceOpen(false)} />}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {visible.map((a) => (
            <article
              key={a.id}
              className={`border-l-4 rounded-md p-3 ${SEV_TONE[a.severity]} ${a.severity === 'CRITICAL' ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-base flex-shrink-0">{SEV_ICON[a.severity]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {a.pinned && <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white">📌 고정</span>}
                    <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-white border border-current">
                      {SEV_LABEL[a.severity]}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm">{a.title}</h3>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                  <div className="text-[0.625rem] font-mono opacity-70 mt-2">
                    {a.authorName} · {new Date(a.publishedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {a.severity !== 'CRITICAL' && (
                  <button
                    onClick={() => dismissOne(a.id)}
                    className="text-sm font-bold px-2 py-0.5 rounded bg-white/60 hover:bg-white flex-shrink-0"
                  >
                    ✓ 확인
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex items-center justify-between">
          <span className="text-[0.6875rem] text-ink-faint font-bold">
            {hasCritical ? '🚨 긴급 공지는 확인 필수' : '✕ 또는 외부 클릭 시 다음 접속 시 다시 표시'}
          </span>
          <button
            onClick={confirmAll}
            className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold active:scale-95"
          >
            {hasCritical ? '✓ 일반 공지만 확인' : '✓ 모두 확인'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popup-in {
          from { transform: scale(0.92) translateY(8px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-popup-in { animation: popup-in 200ms ease-out; }
      `}</style>
    </div>
  );
}
