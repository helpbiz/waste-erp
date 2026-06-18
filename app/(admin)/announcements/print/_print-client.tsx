'use client';

import { useEffect, useState } from 'react';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  audience: string;
  pinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  authorName: string;
  authorRole: string | null;
  attachmentUrls: string[] | null;
};

const SEV_LABEL: Record<string, string> = { INFO: '일반', WARNING: '주의', CRITICAL: '긴급' };
const AUD_LABEL: Record<string, string> = {
  ALL: '전체', OWNER: '대표', ADMIN: '관리자', WORKER: '근로자', MUNI: '지자체',
};

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function AnnouncementsPrintClient({
  from: initFrom,
  to: initTo,
  autoprint = false,
  singleId = null,
  companyName = 'WCI 클린 ERP',
}: {
  from: string;
  to: string;
  autoprint?: boolean;
  singleId?: string | null;
  companyName?: string;
}) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [allItems, setAllItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeExpired, setIncludeExpired] = useState(false);

  const filtered = singleId
    ? allItems.filter((a) => a.id === singleId)
    : allItems.filter((a) => {
        const pub = new Date(a.publishedAt);
        const fromD = new Date(from + 'T00:00:00');
        const toD = new Date(to + 'T23:59:59');
        if (pub < fromD || pub > toD) return false;
        if (!includeExpired && a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
        return true;
      });

  function load() {
    setLoading(true);
    setError(null);
    fetch('/api/announcements?admin=true&includeExpired=true')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setAllItems(d.items ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if ((autoprint || singleId) && !loading && filtered.length > 0) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [autoprint, singleId, loading, filtered.length]);

  /* A4 1페이지 맞춤 — beforeprint 시 내용이 길면 자동 축소 */
  useEffect(() => {
    // 용지 여백 12mm × 2 = 24mm, 가용 높이 273mm ≈ 1033px @ 96dpi (보수적으로 980px 사용)
    const PAGE_H = 980;

    function scaleToFit() {
      document.querySelectorAll<HTMLElement>('.ann-page').forEach((el) => {
        el.style.zoom = '';
        const h = el.scrollHeight;
        if (h > PAGE_H) {
          el.style.zoom = (PAGE_H / h).toFixed(4);
        }
      });
    }
    function resetZoom() {
      document.querySelectorAll<HTMLElement>('.ann-page').forEach((el) => {
        el.style.zoom = '';
      });
    }
    window.addEventListener('beforeprint', scaleToFit);
    window.addEventListener('afterprint', resetZoom);
    return () => {
      window.removeEventListener('beforeprint', scaleToFit);
      window.removeEventListener('afterprint', resetZoom);
    };
  }, []);

  return (
    <>
      <style>{`
        @media print {
          /* 헤더(햄버거·타이틀·로그아웃) + 드로어 숨기기 */
          header, aside, nav, [data-sidebar] { display: none !important; }
          /* 컨트롤 바 숨기기 */
          .no-print { display: none !important; }
          /* 스크롤 컨테이너 → 전체 내용 인쇄 */
          html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; background: white !important; }
          main, section { overflow: visible !important; height: auto !important; max-height: none !important; padding: 0 !important; }
          /* 배경색 전부 제거 */
          * { background: white !important; background-color: white !important;
              -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* 페이지 설정 */
          @page { size: A4 portrait; margin: 12mm; }
          /* 공지 1건 = 1페이지 */
          .ann-page { page-break-after: always; break-after: page; margin: 0 !important; box-shadow: none !important; }
          .ann-page:last-child { page-break-after: avoid; break-after: avoid; }
        }
        @media screen {
          body { background: #f1f5f9; }
          .ann-page {
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          }
        }
      `}</style>

      {/* 화면용 컨트롤 */}
      <div className="no-print p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 sticky top-0 z-10">
        <span className="font-extrabold text-sm text-ink">공지사항 출력</span>
        {!singleId && (
          <>
            <label className="text-xs text-ink-muted font-bold">
              시작일
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="ml-1 border border-line rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs text-ink-muted font-bold">
              종료일
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="ml-1 border border-line rounded px-1.5 py-0.5 text-xs"
              />
            </label>
            <label className="text-xs text-ink-muted font-bold flex items-center gap-1">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="rounded"
              />
              만료된 공지 포함
            </label>
          </>
        )}
        {singleId && <span className="text-xs text-ink-muted">단건 출력 모드</span>}
        {!loading && (
          <button
            onClick={load}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-extrabold"
          >
            새로고침
          </button>
        )}
        {!loading && filtered.length > 0 && (
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded bg-slate-800 text-white text-xs font-extrabold"
          >
            인쇄 ({filtered.length}건)
          </button>
        )}
        {loading && <span className="text-xs text-ink-muted">불러오는 중…</span>}
        {error && <span className="text-xs text-red-600">오류: {error}</span>}
      </div>

      {/* 출력 본문 */}
      <div className="p-4 max-w-[210mm] mx-auto">
        {!loading && filtered.length === 0 && !error && (
          <div className="text-center text-sm text-ink-muted py-16">해당 기간에 공지사항이 없습니다.</div>
        )}

        {filtered.map((ann, idx) => {
          const expired = ann.expiresAt && new Date(ann.expiresAt) < new Date();
          return (
            <div key={ann.id} className="ann-page bg-white rounded-lg p-8">
              {/* 헤더 */}
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-5">
                <div>
                  <div className="text-xl font-black text-slate-900">공지사항</div>
                  <div className="text-xs text-slate-500 mt-0.5">{companyName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">공지번호</div>
                  <div className="text-lg font-black text-slate-700">No.{String(idx + 1).padStart(3, '0')}</div>
                </div>
              </div>

              {/* 메타 테이블 */}
              <table className="w-full border-collapse text-sm mb-5">
                <tbody>
                  <tr className="border border-slate-300">
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 w-24 border-r border-slate-300">등급</th>
                    <td className="px-3 py-2 text-slate-800">
                      {SEV_LABEL[ann.severity] ?? ann.severity}
                      {expired && <span className="ml-2 text-xs text-slate-400">(만료)</span>}
                    </td>
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 w-20 border-l border-r border-slate-300">대상</th>
                    <td className="px-3 py-2 text-slate-800">{AUD_LABEL[ann.audience] ?? ann.audience}</td>
                  </tr>
                  <tr className="border border-slate-300">
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-r border-slate-300">게시일시</th>
                    <td className="px-3 py-2 text-slate-800">{fmtDt(ann.publishedAt)}</td>
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-l border-r border-slate-300">만료일시</th>
                    <td className="px-3 py-2 text-slate-800">{ann.expiresAt ? fmtDt(ann.expiresAt) : '영구 보관'}</td>
                  </tr>
                  <tr className="border border-slate-300">
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-r border-slate-300">작성자</th>
                    <td className="px-3 py-2 text-slate-800" colSpan={3}>{ann.authorName}</td>
                  </tr>
                </tbody>
              </table>

              {/* 제목 */}
              <div className="mb-4">
                <div className="font-extrabold text-slate-700 text-sm mb-1.5 border-b border-slate-200 pb-1">제목</div>
                <div className="text-base font-bold text-slate-900 border border-slate-200 rounded p-3 bg-slate-50">
                  {ann.pinned && <span className="mr-1.5 text-indigo-600">[고정]</span>}
                  {ann.title}
                </div>
              </div>

              {/* 내용 */}
              <div className="mb-5">
                <div className="font-extrabold text-slate-700 text-sm mb-1.5 border-b border-slate-200 pb-1">내용</div>
                <div className="border border-slate-200 rounded p-3 min-h-[80px] print:min-h-0 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed bg-slate-50">
                  {ann.body}
                </div>
              </div>

              {/* 첨부 사진 */}
              {ann.attachmentUrls && ann.attachmentUrls.length > 0 && (
                <div className="mb-5">
                  <div className="font-extrabold text-slate-700 text-sm mb-1.5 border-b border-slate-200 pb-1">첨부 사진</div>
                  <div className="flex flex-wrap gap-3">
                    {ann.attachmentUrls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt={`첨부 ${i + 1}`} className="w-40 h-40 object-cover rounded border border-slate-200" />
                    ))}
                  </div>
                </div>
              )}

              {/* 확인란 */}
              <div className="mt-auto pt-4 border-t border-slate-200 flex justify-end gap-8">
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-6">담당자</div>
                  <div className="text-xs text-slate-400 border-t border-slate-300 pt-1 w-24">(서명)</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-6">관리자</div>
                  <div className="text-xs text-slate-400 border-t border-slate-300 pt-1 w-24">(서명)</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
