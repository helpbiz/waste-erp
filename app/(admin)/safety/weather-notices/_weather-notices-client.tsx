'use client';

import { useState, useEffect, useCallback } from 'react';

const ALERT_COLOR: Record<string, string> = {
  HEATWAVE: 'bg-red-100 text-red-800 border-red-300',
  COLDWAVE: 'bg-blue-100 text-blue-800 border-blue-300',
  TYPHOON:  'bg-purple-100 text-purple-800 border-purple-300',
  STORM:    'bg-slate-100 text-slate-800 border-slate-300',
  OTHER:    'bg-amber-100 text-amber-800 border-amber-300',
};

type Notice = {
  id: string; noticeDate: string; alertType: string; alertLabel: string;
  title: string; content: string | null; createdBy: string; createdAt: string; photoCount: number;
};
type PhotoRecord = {
  id: string; workerName: string; employeeNo: string | null;
  photoData: string; uploadedAt: string;
  recordTime: string | null; feelsLike: number | null;
  actionTaken: string | null; managerName: string | null;
};

export default function WeatherNoticesClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState(today);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [records, setRecords] = useState<PhotoRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/safety/weather-notices?date=${date}`);
      const d = await r.json();
      setNotices(d.notices ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filterDate); }, [filterDate, load]);

  async function openRecords(notice: Notice) {
    setSelectedNotice(notice);
    setRecordsLoading(true);
    try {
      const r = await fetch(`/api/safety/weather-notices/${notice.id}/photos`);
      const d = await r.json();
      setRecords(d.photos ?? []);
    } finally { setRecordsLoading(false); }
  }

  async function handleExport(noticeId: string, withImages: boolean) {
    setExporting(true);
    try {
      const res = await fetch(`/api/safety/weather-notices/${noticeId}/export?images=${withImages}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `날씨관리대장_${filterDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-ink">날씨관리대장</h2>
        <p className="text-xs font-bold text-ink-muted mt-1">폭염·한파 등 기상 안전 — 근로자 기록 조회 및 Excel 출력</p>
      </div>

      {/* 날짜 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent" />
        <span className="text-xs font-mono text-ink-muted">{notices.length}건</span>
        <a
          href={`/safety/weather-notices/print?from=${filterDate}&to=${filterDate}`}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 ml-auto"
        >
          🖨 일자별 출력
        </a>
        <a
          href="/safety/weather-notices/print"
          className="px-3 py-1.5 rounded-lg border border-line bg-white text-xs font-bold hover:bg-slate-50"
        >
          📅 기간별 출력
        </a>
      </div>

      {/* 공지 목록 */}
      {loading ? (
        <div className="py-12 text-center text-sm font-bold text-ink-muted">불러오는 중…</div>
      ) : notices.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-12 text-center text-sm font-bold text-ink-muted">
          해당 날짜의 공지가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => (
            <div key={n.id} className="bg-surface border border-line rounded-xl p-4 flex items-start gap-3">
              <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold border flex-shrink-0 mt-0.5 ${ALERT_COLOR[n.alertType] ?? ALERT_COLOR.OTHER}`}>
                {n.alertLabel}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-ink">{n.title}</div>
                {n.content && <div className="text-xs text-ink-muted mt-0.5 line-clamp-1">{n.content}</div>}
                <div className="text-[0.6875rem] font-mono text-ink-muted mt-1">
                  {n.noticeDate} · {n.createdBy} 등록 · <span className="font-bold text-accent">기록 {n.photoCount}명</span>
                </div>
              </div>
              <button onClick={() => openRecords(n)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-line text-xs font-extrabold hover:bg-surface-soft">
                기록 보기
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 기록 상세 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4" onClick={() => setSelectedNotice(null)}>
          <div className="w-full max-w-4xl bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <div className="text-base font-extrabold text-ink">{selectedNotice.title}</div>
                <div className="text-xs font-mono text-ink-muted mt-0.5">{selectedNotice.noticeDate} · {records.length}명 기록</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport(selectedNotice.id, false)} disabled={exporting}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-extrabold hover:bg-surface-soft disabled:opacity-50">
                  📊 Excel (텍스트)
                </button>
                <button onClick={() => handleExport(selectedNotice.id, true)} disabled={exporting}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-50">
                  {exporting ? '생성 중…' : '📊 Excel (이미지 포함)'}
                </button>
                <button onClick={() => setSelectedNotice(null)} className="text-2xl font-bold text-ink-muted px-1">×</button>
              </div>
            </header>

            <div className="p-4">
              {recordsLoading ? (
                <div className="py-12 text-center text-sm font-bold text-ink-muted">불러오는 중…</div>
              ) : records.length === 0 ? (
                <div className="py-12 text-center text-sm font-bold text-ink-muted">제출된 기록이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-surface-soft border-b-2 border-line text-[0.6875rem] font-extrabold text-ink-muted uppercase tracking-wide">
                        {['직원명', '사원번호', '기록시간', '체감온도', '조치사항', '담당자', '사진', '제출일시'].map((h) => (
                          <th key={h} className="text-left px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id} className={`border-b border-line ${i % 2 === 1 ? 'bg-surface-soft' : ''}`}>
                          <td className="px-3 py-2 font-bold text-ink">{r.workerName}</td>
                          <td className="px-3 py-2 font-mono text-ink-muted">{r.employeeNo ?? '—'}</td>
                          <td className="px-3 py-2 font-mono">{r.recordTime ?? '—'}</td>
                          <td className="px-3 py-2 font-mono">
                            {r.feelsLike != null ? (
                              <span className={`font-extrabold ${r.feelsLike >= 33 ? 'text-danger' : r.feelsLike <= 0 ? 'text-info' : 'text-ink'}`}>
                                {r.feelsLike}℃
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <span className="line-clamp-2 text-ink-muted">{r.actionTaken ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2">{r.managerName ?? '—'}</td>
                          <td className="px-3 py-2">
                            {r.photoData ? (
                              <button onClick={() => setLightbox(r.photoData)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={r.photoData} alt="인증사진" className="w-14 h-14 object-cover rounded-lg border border-line hover:opacity-80" />
                              </button>
                            ) : <span className="text-ink-muted">없음</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-ink-muted text-[0.625rem]">
                            {new Date(r.uploadedAt).toLocaleString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 사진 라이트박스 */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="인증사진 확대" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
