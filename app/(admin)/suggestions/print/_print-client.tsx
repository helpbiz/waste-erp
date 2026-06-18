'use client';

import { useEffect, useState } from 'react';

type Cat = 'WORK_ENV' | 'EQUIPMENT' | 'SAFETY' | 'MANAGEMENT' | 'WELFARE' | 'OTHER';
type Status = 'NEW' | 'REVIEWING' | 'ANSWERED' | 'ARCHIVED';

const CAT_LABEL: Record<Cat, string> = {
  WORK_ENV:   '업무환경',
  EQUIPMENT:  '장비/도구',
  SAFETY:     '안전',
  MANAGEMENT: '관리/소통',
  WELFARE:    '복지/처우',
  OTHER:      '기타',
};

const STATUS_LABEL: Record<Status, string> = {
  NEW:       '신규',
  REVIEWING: '검토 중',
  ANSWERED:  '답변 완료',
  ARCHIVED:  '보관',
};

const SAT_LABEL: Record<number, string> = {
  1: '1점 (매우 불만)',
  2: '2점 (불만)',
  3: '3점 (보통)',
  4: '4점 (만족)',
  5: '5점 (매우 만족)',
};

type Item = {
  id: string;
  category: Cat;
  satisfactionScore: number;
  content: string;
  photos: string[];
  status: Status;
  createdAt: string;
  departmentName: string | null;
  positionCode: string | null;
  replies: { id: string; content: string; createdAt: string; replierName: string; replierRole: string }[];
};

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function SuggestionsPrintClient({
  from: initFrom,
  to: initTo,
  autoprint = false,
}: {
  from: string;
  to: string;
  autoprint?: boolean;
}) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(f: string, t: string) {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/suggestions/export?from=${f}&to=${t}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setItems(d.items ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(initFrom, initTo); }, [initFrom, initTo]);

  useEffect(() => {
    if (autoprint && !loading && items.length > 0) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [autoprint, loading, items.length]);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .suggestion-page {
            page-break-after: always;
            break-after: page;
          }
          .suggestion-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
        @media screen {
          body { background: #f1f5f9; }
          .suggestion-page {
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          }
        }
      `}</style>

      {/* 화면용 컨트롤 */}
      <div className="no-print p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 sticky top-0 z-10 print:hidden">
        <span className="font-extrabold text-sm text-ink">익명 건의함 출력</span>
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
        <button
          onClick={() => load(from, to)}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-extrabold"
        >
          조회
        </button>
        {!loading && items.length > 0 && (
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded bg-slate-800 text-white text-xs font-extrabold"
          >
            인쇄 ({items.length}건)
          </button>
        )}
        {loading && <span className="text-xs text-ink-muted">불러오는 중…</span>}
        {error && <span className="text-xs text-red-600">오류: {error}</span>}
      </div>

      {/* 출력 본문 */}
      <div className="p-4 max-w-[210mm] mx-auto">
        {!loading && items.length === 0 && !error && (
          <div className="text-center text-sm text-ink-muted py-16">해당 기간에 건의 내용이 없습니다.</div>
        )}

        {items.map((item, idx) => (
          <div key={item.id} className="suggestion-page bg-white rounded-lg p-8" style={{ minHeight: '270mm' }}>
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-6">
              <div>
                <div className="text-xl font-black text-slate-900">익명 건의함</div>
                <div className="text-xs text-slate-500 mt-0.5">작성자 식별 정보는 수집·저장되지 않습니다</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">접수번호</div>
                <div className="text-lg font-black text-slate-700">No.{String(idx + 1).padStart(3, '0')}</div>
              </div>
            </div>

            {/* 메타 정보 */}
            <table className="w-full border-collapse text-sm mb-6">
              <tbody>
                <tr className="border border-slate-300">
                  <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 w-24 border-r border-slate-300">접수일시</th>
                  <td className="px-3 py-2 text-slate-800">{fmtDt(item.createdAt)}</td>
                  <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 w-20 border-l border-r border-slate-300">상태</th>
                  <td className="px-3 py-2 text-slate-800">{STATUS_LABEL[item.status]}</td>
                </tr>
                <tr className="border border-slate-300">
                  <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-r border-slate-300">카테고리</th>
                  <td className="px-3 py-2 text-slate-800">{CAT_LABEL[item.category] ?? item.category}</td>
                  <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-l border-r border-slate-300">만족도</th>
                  <td className="px-3 py-2 text-slate-800">{SAT_LABEL[item.satisfactionScore] ?? `${item.satisfactionScore}점`}</td>
                </tr>
                {(item.departmentName || item.positionCode) && (
                  <tr className="border border-slate-300">
                    <th className="bg-slate-50 px-3 py-2 text-left font-extrabold text-slate-700 border-r border-slate-300">부서/직위</th>
                    <td className="px-3 py-2 text-slate-800" colSpan={3}>
                      {[item.departmentName, item.positionCode].filter(Boolean).join(' · ')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* 건의 내용 */}
            <div className="mb-6">
              <div className="font-extrabold text-slate-700 text-sm mb-2 border-b border-slate-200 pb-1">건의 내용</div>
              <div className="border border-slate-200 rounded p-3 min-h-[120px] text-sm text-slate-900 whitespace-pre-wrap leading-relaxed bg-slate-50">
                {item.content}
              </div>
            </div>

            {/* 사진 */}
            {item.photos.length > 0 && (
              <div className="mb-6">
                <div className="font-extrabold text-slate-700 text-sm mb-2 border-b border-slate-200 pb-1">첨부 사진</div>
                <div className="flex flex-wrap gap-3">
                  {item.photos.map((p, i) => (
                    <img key={i} src={p} alt={`사진 ${i + 1}`} className="w-40 h-40 object-cover rounded border border-slate-200" />
                  ))}
                </div>
              </div>
            )}

            {/* 답변 */}
            {item.replies.length > 0 && (
              <div className="mb-6">
                <div className="font-extrabold text-slate-700 text-sm mb-2 border-b border-slate-200 pb-1">관리자 답변</div>
                <div className="space-y-3">
                  {item.replies.map((r) => (
                    <div key={r.id} className="border border-slate-200 rounded p-3 bg-emerald-50">
                      <div className="text-[0.6875rem] font-extrabold text-emerald-800 mb-1.5">
                        {r.replierName} · {fmtDt(r.createdAt)}
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.replies.length === 0 && (
              <div className="mb-6">
                <div className="font-extrabold text-slate-700 text-sm mb-2 border-b border-slate-200 pb-1">관리자 답변</div>
                <div className="border border-dashed border-slate-300 rounded p-3 min-h-[60px] text-sm text-slate-400 italic">
                  답변 예정
                </div>
              </div>
            )}

            {/* 서명란 */}
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
        ))}
      </div>
    </>
  );
}
