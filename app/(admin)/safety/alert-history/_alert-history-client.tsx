'use client';

import { useState, useEffect } from 'react';

type AlertLog = {
  id: string;
  actorName: string;
  createdAt: string;
  metadata: {
    type?: string; typeLabel?: string;
    recipientCount?: number; provider?: string;
    sent?: number; failed?: number; messageLen?: number;
  } | null;
};

const TYPE_EMOJI: Record<string, string> = {
  POKYUM: '☀️', HANPA: '❄️', POKWU: '☂️', POKSEOL: '🌨', GANGPUNG: '💨', ETC: '⚠️',
};

export default function AlertHistoryClient() {
  const [items, setItems] = useState<AlertLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(offset = 0) {
    setLoading(true);
    setError(null);
    fetch(`/api/safety/weather-alert/history?limit=50&offset=${offset}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setItems(d.items); setTotal(d.total); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <a href="/safety" className="text-sm font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-white">
          ← 안전관리
        </a>
        <a href="/print" className="text-sm font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-slate-50">
          🖨 출력센터
        </a>
        <h2 className="text-xl font-black text-ink tracking-tight">기상안전 공지 발송이력</h2>
        <span className="ml-auto text-sm text-ink-muted">총 {total}건</span>
      </div>

      {loading && <div className="py-10 text-center text-ink-faint text-sm">로딩 중…</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">{error}</div>}

      {!loading && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="py-12 text-center text-ink-faint text-sm">발송이력이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-line">
                <tr>
                  <th className="px-4 py-2 text-left font-extrabold text-sm">발송일시</th>
                  <th className="px-4 py-2 text-left font-extrabold text-sm">유형</th>
                  <th className="px-4 py-2 text-center font-extrabold text-sm">수신인원</th>
                  <th className="px-4 py-2 text-center font-extrabold text-sm">발송</th>
                  <th className="px-4 py-2 text-center font-extrabold text-sm">실패</th>
                  <th className="px-4 py-2 text-left font-extrabold text-sm hidden md:table-cell">발송자</th>
                  <th className="px-4 py-2 text-left font-extrabold text-sm hidden lg:table-cell">수단</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => {
                  const m = item.metadata;
                  const dt = new Date(item.createdAt);
                  const dateStr = dt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  const emoji = m?.type ? (TYPE_EMOJI[m.type] ?? '⚠️') : '⚠️';
                  return (
                    <tr key={item.id} className="hover:bg-surface-soft transition">
                      <td className="px-4 py-2 text-sm font-mono whitespace-nowrap">
                        <span className="font-bold">{dateStr}</span>
                        <span className="text-ink-muted ml-1">{timeStr}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm">{emoji}</span>
                        <span className="ml-1 text-sm font-bold">{m?.typeLabel ?? '기타'}</span>
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-sm">{m?.recipientCount ?? '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-emerald-600 font-bold text-sm">{m?.sent ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`font-bold text-sm ${(m?.failed ?? 0) > 0 ? 'text-red-600' : 'text-ink-faint'}`}>
                          {m?.failed ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-ink-muted hidden md:table-cell">{item.actorName}</td>
                      <td className="px-4 py-2 text-sm text-ink-muted hidden lg:table-cell">{m?.provider ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
