'use client';

import { useState, useEffect } from 'react';

type TbmItem = {
  id: string;
  sessionId: string;
  sessionDate: string;
  topic: string;
  content: string | null;
  department: string | null;
  facilityName: string | null;
  createdBy: string;
  signedAt: string;
};

export default function TbmHistoryWorkerClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<TbmItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(y: number) {
    setLoading(true);
    setError(null);
    fetch(`/api/tbm/my-history?year=${y}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setItems(d.items); setTotal(d.total); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(year); }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <a href="/worker/safety" className="text-xs font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-white">
          ← 안전관리
        </a>
        <h2 className="text-xl font-black text-ink tracking-tight">나의 TBM 참여이력</h2>
      </div>

      {/* 연도 선택 */}
      <div className="bg-surface border border-line rounded-xl p-4 flex items-end gap-3">
        <div>
          <div className="text-xs font-mono font-extrabold text-slate-600 mb-1">연도</div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        <button onClick={() => load(year)}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
          조회
        </button>
        {!loading && (
          <span className="ml-auto text-xs text-ink-muted">
            {year}년 총 <strong>{total}회</strong> 참여 · <strong>{total * 30}분</strong>
          </span>
        )}
      </div>

      {loading && <div className="py-10 text-center text-slate-500 text-sm">로딩 중…</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="py-12 text-center text-slate-500 text-sm">{year}년 TBM 참여이력이 없습니다.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const sessionDt = new Date(item.sessionDate);
            const dow = ['일', '월', '화', '수', '목', '금', '토'][sessionDt.getUTCDay()];
            const dateStr = `${item.sessionDate} (${dow})`;
            const signDt = new Date(item.signedAt);
            const signTime = signDt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={item.id} className="bg-white border border-line rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-slate-500 mb-0.5">{dateStr}</div>
                    <div className="font-extrabold text-ink text-sm truncate">{item.topic}</div>
                    {item.content && (
                      <div className="text-xs text-ink-muted mt-1 line-clamp-2 whitespace-pre-wrap">{item.content}</div>
                    )}
                    <div className="text-xs text-slate-400 mt-1.5">
                      {item.department ?? item.facilityName ?? ''}{(item.department ?? item.facilityName) ? ' · ' : ''}
                      작성: {item.createdBy}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">서명시각</div>
                    <div className="text-xs font-bold text-emerald-600">{signTime}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
