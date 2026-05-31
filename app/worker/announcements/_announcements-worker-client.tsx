'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  pinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  authorName: string;
  audience: string;
  attachmentUrls: string[] | null;
};

const SEVERITY_CLS: Record<string, string> = {
  INFO:     'bg-blue-50 border-blue-300 text-blue-900',
  WARNING:  'bg-amber-50 border-amber-300 text-amber-900',
  CRITICAL: 'bg-red-50 border-red-400 text-red-900',
};

const SEVERITY_LABEL: Record<string, string> = {
  INFO: '일반', WARNING: '주의', CRITICAL: '긴급',
};

function fmt(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default function WorkerAnnouncementsClient({ isNoticeManager }: { isNoticeManager: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setError('공지사항을 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight flex-1">공지사항</h1>
        {isNoticeManager && (
          <Link
            href="/announcements"
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-extrabold active:scale-95"
          >
            + 공지 작성
          </Link>
        )}
      </div>

      {loading && (
        <div className="px-4 py-16 text-center text-ink-muted text-sm">불러오는 중…</div>
      )}
      {error && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700 font-bold">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="px-4 py-16 text-center">
          <div className="text-4xl mb-2">📢</div>
          <div className="text-sm text-ink-muted font-bold">등록된 공지사항이 없습니다</div>
        </div>
      )}

      <div className="px-4 pt-2 space-y-2">
        {items.map((a) => {
          const isOpen = expanded === a.id;
          const cls = SEVERITY_CLS[a.severity] ?? SEVERITY_CLS.INFO;
          return (
            <article key={a.id} className={`rounded-xl border-2 overflow-hidden ${cls}`}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : a.id)}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {a.pinned && (
                    <span className="text-[0.625rem] font-extrabold bg-red-600 text-white px-1.5 py-0.5 rounded">📌 고정</span>
                  )}
                  <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded border border-current">
                    {SEVERITY_LABEL[a.severity] ?? a.severity}
                  </span>
                  <span className="text-[0.625rem] font-mono text-current/60 ml-auto">{fmt(a.publishedAt)}</span>
                </div>
                <div className="text-sm font-extrabold text-current mt-0.5">{a.title}</div>
                {!isOpen && (
                  <div className="text-xs text-current/70 mt-1 line-clamp-1">{a.body}</div>
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-3 border-t border-current/20">
                  <pre className="text-sm whitespace-pre-wrap leading-relaxed mt-2 text-current font-sans">{a.body}</pre>
                  {a.attachmentUrls && a.attachmentUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.attachmentUrls.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt={`첨부사진 ${i + 1}`}
                          className="w-full max-w-sm rounded-xl border border-current/20 object-contain"
                        />
                      ))}
                    </div>
                  )}
                  {/민원 #\d+/.test(a.body) && (
                    <Link
                      href="/worker/complaint"
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-extrabold active:scale-95"
                    >
                      📥 내 민원 탭에서 확인
                    </Link>
                  )}
                  <div className="mt-2 text-[0.625rem] font-mono text-current/50">작성자: {a.authorName}</div>
                  {a.expiresAt && (
                    <div className="text-[0.625rem] font-mono text-current/50">만료: {fmt(a.expiresAt)}</div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
