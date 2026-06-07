'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDateKr(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${DOW[d.getDay()]})`;
}

const ALERT_BG: Record<string, string> = {
  HEATWAVE: '#fff1f2',
  COLDWAVE: '#eff6ff',
  TYPHOON:  '#faf5ff',
  STORM:    '#f8fafc',
  OTHER:    '#fffbeb',
};

const ALERT_BORDER: Record<string, string> = {
  HEATWAVE: '#fca5a5',
  COLDWAVE: '#93c5fd',
  TYPHOON:  '#c4b5fd',
  STORM:    '#cbd5e1',
  OTHER:    '#fcd34d',
};

type Photo = {
  id: string; workerName: string; employeeNo: string | null;
  photoData: string; uploadedAt: string;
  recordTime: string | null; feelsLike: number | null;
  actionTaken: string | null; managerName: string | null;
};

type Notice = {
  id: string; noticeDate: string; alertType: string; alertLabel: string;
  title: string; content: string | null; createdBy: string; photoCount: number;
  photos: Photo[];
};

export default function WeatherPrintClient({
  from: initFrom,
  to: initTo,
  autoprint = false,
}: {
  from: string;
  to: string;
  autoprint?: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initFrom);
  const [to,   setTo]   = useState(initTo);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(true);

  function load(f: string, t: string) {
    setLoading(true);
    setError(null);
    fetch(`/api/safety/weather-notices/print?from=${f}&to=${t}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setNotices(d.notices ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(initFrom, initTo); }, [initFrom, initTo]);

  useEffect(() => {
    if (autoprint && !loading && notices.length > 0) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [autoprint, loading, notices.length]);

  function navigate() {
    const params = new URLSearchParams({ from, to });
    if (!showPhotos) params.set('noPhoto', '1');
    router.push(`/safety/weather-notices/print?${params}`);
    load(from, to);
  }

  function handlePrint() {
    const params = new URLSearchParams({ from, to, autoprint: '1' });
    if (!showPhotos) params.set('noPhoto', '1');
    router.push(`/safety/weather-notices/print?${params}`);
  }

  const totalPhotos = notices.reduce((s, n) => s + n.photoCount, 0);

  return (
    <div className="space-y-4">

      {/* 컨트롤 바 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)}
              className="accent-accent w-4 h-4" />
            <span className="text-xs font-bold text-ink">사진 포함</span>
          </label>
        </div>
        <button onClick={navigate}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
          조회
        </button>
        <button onClick={() => window.print()}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          🖨 인쇄
        </button>
        <button onClick={handlePrint}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700">
          새창 인쇄
        </button>
        <a href="/safety/weather-notices" className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-line hover:bg-slate-50">
          ← 날씨관리대장
        </a>
        {!loading && notices.length > 0 && (
          <div className="w-full text-xs font-bold text-slate-600 print:hidden">
            {from} ~ {to} · 공지 {notices.length}건 · 근로자 기록 {totalPhotos}건
          </div>
        )}
      </div>

      {loading && <div className="py-12 text-center text-slate-500 text-sm print:hidden">로딩 중…</div>}
      {error   && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700 print:hidden">{error}</div>}
      {!loading && notices.length === 0 && !error && (
        <div className="py-16 text-center text-slate-500 text-sm font-bold print:hidden">
          해당 기간에 등록된 날씨관리대장 공지가 없습니다.
        </div>
      )}

      {/* 인쇄 영역 */}
      {!loading && notices.length > 0 && (
        <div className="bg-white print:bg-white wn-wrap">

          {/* 인쇄 전용 문서 제목 */}
          <div className="screen-hidden wn-doc-header">
            <div className="wn-doc-title">날씨관리대장</div>
            <div className="wn-doc-period">{from} ~ {to} · 공지 {notices.length}건 · 기록 {totalPhotos}명</div>
          </div>

          {notices.map((n) => (
            <article key={n.id} className="wn-notice-block">

              {/* 공지 헤더 */}
              <div className="wn-notice-header" style={{ borderLeftColor: ALERT_BORDER[n.alertType] ?? '#cbd5e1' }}>
                <div className="wn-alert-badge" style={{ background: ALERT_BG[n.alertType] ?? '#f8fafc', borderColor: ALERT_BORDER[n.alertType] ?? '#cbd5e1' }}>
                  {n.alertLabel}
                </div>
                <div className="wn-notice-date">{fmtDateKr(n.noticeDate)}</div>
                <div className="wn-notice-title">{n.title}</div>
                {n.content && <div className="wn-notice-content">{n.content}</div>}
                <div className="wn-notice-meta">등록자: {n.createdBy} · 기록 {n.photoCount}명</div>
              </div>

              {/* 근로자 기록 테이블 */}
              {n.photos.length > 0 ? (
                <table className="wn-tbl">
                  <thead>
                    <tr>
                      <th className="wn-col-no">No</th>
                      <th className="wn-col-name">직원명</th>
                      <th className="wn-col-emp">사원번호</th>
                      <th className="wn-col-time">기록시간</th>
                      <th className="wn-col-temp">체감온도</th>
                      <th className="wn-col-action">조치사항</th>
                      <th className="wn-col-mgr">담당자</th>
                      {showPhotos && <th className="wn-col-photo">사진</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {n.photos.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 1 ? 'wn-even' : ''}>
                        <td className="tc">{idx + 1}</td>
                        <td className="fw">{p.workerName}</td>
                        <td className="tc mono">{p.employeeNo ?? '—'}</td>
                        <td className="tc mono">{p.recordTime ?? '—'}</td>
                        <td className="tc mono">
                          {p.feelsLike != null ? (
                            <span style={{ color: p.feelsLike >= 33 ? '#dc2626' : p.feelsLike <= 0 ? '#2563eb' : undefined, fontWeight: 700 }}>
                              {p.feelsLike}℃
                            </span>
                          ) : '—'}
                        </td>
                        <td className="wn-action">{p.actionTaken ?? '—'}</td>
                        <td className="tc">{p.managerName ?? '—'}</td>
                        {showPhotos && (
                          <td className="tc wn-photo-cell">
                            {p.photoData
                              /* eslint-disable-next-line @next/next/no-img-element */
                              ? <img src={p.photoData} alt="인증" className="wn-photo print:hidden" />
                              : <span className="wn-no-photo">없음</span>}
                            {p.photoData
                              /* eslint-disable-next-line @next/next/no-img-element */
                              ? <img src={p.photoData} alt="인증" className="wn-photo screen-hidden" />
                              : null}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="wn-no-records">제출된 기록 없음</div>
              )}

            </article>
          ))}

        </div>
      )}

      <style>{`
        .screen-hidden { display: none; }

        /* ── 공통 ── */
        .wn-wrap {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        }
        .wn-doc-header {
          text-align: center;
          border-bottom: 2.5px double #374151;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .wn-doc-title  { font-size: 18pt; font-weight: 900; }
        .wn-doc-period { font-size: 10pt; color: #4b5563; margin-top: 3px; }

        .wn-notice-block {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .wn-notice-header {
          border-left: 4px solid #9ca3af;
          padding: 8px 10px 6px;
          margin-bottom: 4px;
          background: #f9fafb;
        }
        .wn-alert-badge {
          display: inline-block;
          font-size: 9pt;
          font-weight: 800;
          padding: 1px 8px;
          border-radius: 12px;
          border: 1px solid;
          margin-bottom: 4px;
        }
        .wn-notice-date    { font-size: 11pt; font-weight: 700; color: #111; }
        .wn-notice-title   { font-size: 12pt; font-weight: 900; color: #111; margin: 2px 0; }
        .wn-notice-content { font-size: 9pt; color: #374151; white-space: pre-wrap; margin: 3px 0; }
        .wn-notice-meta    { font-size: 8.5pt; color: #6b7280; margin-top: 3px; }

        .wn-tbl {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 4px;
        }
        .wn-tbl th, .wn-tbl td {
          border: 1px solid #9ca3af;
          padding: 4px 5px;
          font-size: 9.5pt;
          vertical-align: middle;
        }
        .wn-tbl th {
          background: #e2e8f0;
          font-weight: 700;
          text-align: center;
        }
        .wn-even td { background: #f8fafc; }

        .tc    { text-align: center; }
        .fw    { font-weight: 700; }
        .mono  { font-family: 'Courier New', monospace; }

        .wn-col-no     { width: 32px; }
        .wn-col-name   { width: 70px; }
        .wn-col-emp    { width: 80px; }
        .wn-col-time   { width: 68px; }
        .wn-col-temp   { width: 70px; }
        .wn-col-mgr    { width: 70px; }
        .wn-col-photo  { width: 72px; }
        .wn-action     { word-break: keep-all; }

        .wn-photo { width: 60px; height: 45px; object-fit: cover; border-radius: 4px; }
        .wn-photo-cell { padding: 3px !important; }
        .wn-no-photo { font-size: 8pt; color: #9ca3af; }
        .wn-no-records {
          font-size: 9pt; color: #9ca3af; font-style: italic;
          padding: 8px 12px; border: 1px dashed #d1d5db;
          border-radius: 4px; text-align: center; margin-bottom: 4px;
        }

        /* ── 인쇄 전용 ── */
        @media print {
          header, aside, nav, [data-sidebar], .sidebar { display: none !important; }
          .screen-hidden { display: block !important; }
          .print\\:hidden { display: none !important; }

          @page { size: A4 portrait; margin: 10mm 8mm; }

          html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          main, section { overflow: visible !important; height: auto !important; max-height: none !important; }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 9pt !important;
            background: white !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .wn-wrap { margin: 0 !important; }
          .wn-doc-header { display: block !important; }
          .wn-doc-title  { font-size: 16pt !important; }
          .wn-doc-period { font-size: 9pt !important; }

          .wn-notice-block { break-inside: avoid; }
          .wn-notice-title { font-size: 11pt !important; }
          .wn-notice-date  { font-size: 10pt !important; }

          .wn-tbl th, .wn-tbl td { font-size: 8.5pt !important; padding: 3px 4px !important; }
          .wn-tbl th { background: #e2e8f0 !important; }
          .wn-even td { background: #f8fafc !important; }

          .wn-photo { width: 55px !important; height: 42px !important; }
        }
      `}</style>
    </div>
  );
}
