'use client';

import { useState, useEffect, useCallback } from 'react';

const ALERT_TYPE_OPTIONS = [
  { value: 'HEATWAVE', label: '폭염' },
  { value: 'COLDWAVE', label: '한파' },
  { value: 'TYPHOON', label: '태풍' },
  { value: 'STORM', label: '강풍·폭우' },
  { value: 'OTHER', label: '기타' },
] as const;

const ALERT_COLOR: Record<string, string> = {
  HEATWAVE: 'bg-red-100 text-red-800 border-red-300',
  COLDWAVE: 'bg-blue-100 text-blue-800 border-blue-300',
  TYPHOON: 'bg-purple-100 text-purple-800 border-purple-300',
  STORM: 'bg-slate-100 text-slate-800 border-slate-300',
  OTHER: 'bg-amber-100 text-amber-800 border-amber-300',
};

type Notice = {
  id: string; noticeDate: string; alertType: string; alertLabel: string;
  title: string; content: string | null; createdBy: string; createdAt: string; photoCount: number;
};
type Photo = { id: string; workerName: string; employeeNo: string | null; photoData: string; uploadedAt: string };

export default function WeatherNoticesClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState(today);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  const [form, setForm] = useState({
    alertType: 'HEATWAVE' as typeof ALERT_TYPE_OPTIONS[number]['value'],
    title: '',
    content: '',
    noticeDate: today,
  });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/safety/weather-notices?date=${date}`);
      const d = await r.json();
      setNotices(d.notices ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filterDate); }, [filterDate, load]);

  async function handleAdd() {
    if (!form.title.trim()) { setAddError('제목을 입력하세요.'); return; }
    setSubmitting(true); setAddError('');
    const r = await fetch('/api/safety/weather-notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, content: form.content || undefined }),
    });
    setSubmitting(false);
    if (!r.ok) { const d = await r.json(); setAddError(d.error ?? '등록 실패'); return; }
    setShowAdd(false);
    setForm({ alertType: 'HEATWAVE', title: '', content: '', noticeDate: today });
    load(filterDate);
  }

  async function openPhotos(notice: Notice) {
    setSelectedNotice(notice);
    setPhotosLoading(true);
    try {
      const r = await fetch(`/api/safety/weather-notices/${notice.id}/photos`);
      const d = await r.json();
      setPhotos(d.photos ?? []);
    } finally {
      setPhotosLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-ink">날씨관리대장</h2>
        <p className="text-xs font-bold text-ink-muted mt-1">폭염·한파 등 기상 안전 공지 등록 및 근로자 휴식 인증 사진 관리</p>
      </div>

      {/* 필터 + 추가 */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent" />
        <span className="text-xs font-mono text-ink-muted">{notices.length}건</span>
        <button onClick={() => setShowAdd((v) => !v)}
          className="ml-auto px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800">
          + 공지 등록
        </button>
      </div>

      {/* 공지 등록 폼 */}
      {showAdd && (
        <div className="bg-surface border-2 border-accent rounded-xl p-4 space-y-3">
          <div className="text-sm font-extrabold text-ink">기상 안전 공지 등록</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-extrabold text-ink-muted">공지 날짜</span>
              <input type="date" value={form.noticeDate}
                onChange={(e) => setForm({ ...form, noticeDate: e.target.value })}
                className="px-3 py-2 rounded-lg border border-line text-sm font-bold focus:outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-extrabold text-ink-muted">유형</span>
              <select value={form.alertType} onChange={(e) => setForm({ ...form, alertType: e.target.value as typeof form.alertType })}
                className="px-3 py-2 rounded-lg border border-line text-sm font-bold bg-white focus:outline-none focus:border-accent">
                {ALERT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-extrabold text-ink-muted">제목 *</span>
            <input type="text" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 폭염 특보 발령 — 오후 휴식 인증 필수"
              className="px-3 py-2 rounded-lg border border-line text-sm font-bold focus:outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-extrabold text-ink-muted">내용</span>
            <textarea rows={3} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="근로자에게 전달할 안전 지시사항을 입력하세요."
              className="px-3 py-2 rounded-lg border border-line text-sm font-bold resize-none focus:outline-none focus:border-accent" />
          </label>
          {addError && <div className="text-xs font-bold text-danger">{addError}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setAddError(''); }}
              className="px-4 py-2 rounded-lg border border-line text-sm font-bold">취소</button>
            <button onClick={handleAdd} disabled={submitting}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50">
              {submitting ? '등록 중…' : '등록'}
            </button>
          </div>
        </div>
      )}

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
                {n.content && <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.content}</div>}
                <div className="text-[0.6875rem] font-mono text-ink-muted mt-1">
                  {n.noticeDate} · {n.createdBy} 등록
                </div>
              </div>
              <button
                onClick={() => openPhotos(n)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-line text-xs font-extrabold hover:bg-surface-soft"
              >
                사진 {n.photoCount}장
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 사진 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4" onClick={() => setSelectedNotice(null)}>
          <div className="w-full max-w-2xl bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
              <div className="flex-1">
                <div className="text-base font-extrabold text-ink">휴식 인증 사진</div>
                <div className="text-xs font-mono text-ink-muted mt-0.5">{selectedNotice.title} · {selectedNotice.noticeDate}</div>
              </div>
              <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">🖨 인쇄</button>
              <button onClick={() => setSelectedNotice(null)} className="text-2xl font-bold text-ink-muted">×</button>
            </header>
            <div className="p-5">
              {photosLoading ? (
                <div className="py-12 text-center text-sm font-bold text-ink-muted">불러오는 중…</div>
              ) : photos.length === 0 ? (
                <div className="py-12 text-center text-sm font-bold text-ink-muted">제출된 사진이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {photos.map((p) => (
                    <div key={p.id} className="bg-slate-50 rounded-xl border border-line overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.photoData} alt={`${p.workerName} 휴식 인증`} className="w-full object-cover aspect-video" />
                      <div className="px-3 py-2">
                        <div className="text-xs font-extrabold text-ink">{p.workerName}</div>
                        {p.employeeNo && <div className="text-[0.625rem] font-mono text-ink-muted">{p.employeeNo}</div>}
                        <div className="text-[0.625rem] font-mono text-ink-muted mt-0.5">
                          {new Date(p.uploadedAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden, header, aside, nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
