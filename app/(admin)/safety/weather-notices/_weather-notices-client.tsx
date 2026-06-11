'use client';

import { useState, useEffect, useCallback } from 'react';

const ALERT_COLOR: Record<string, string> = {
  HEATWAVE: 'bg-red-100 text-red-800 border-red-300',
  COLDWAVE: 'bg-blue-100 text-blue-800 border-blue-300',
  TYPHOON:  'bg-purple-100 text-purple-800 border-purple-300',
  STORM:    'bg-slate-100 text-ink-muted border-slate-300',
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

const ALERT_TYPES = [
  { value: 'HEATWAVE', label: '폭염' },
  { value: 'COLDWAVE', label: '한파' },
  { value: 'TYPHOON',  label: '태풍' },
  { value: 'STORM',    label: '강풍·폭우' },
  { value: 'OTHER',    label: '기타' },
];

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

  /* 공지 등록 */
  const [showForm, setShowForm] = useState(false);
  const [formAlertType, setFormAlertType] = useState('HEATWAVE');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* 공지 수정 */
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editAlertType, setEditAlertType] = useState('HEATWAVE');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /* 공지 삭제 */
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) { setSaveError('제목을 입력하세요.'); return; }
    setSaving(true); setSaveError(null);
    const r = await fetch('/api/safety/weather-notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: formAlertType, title: formTitle.trim(), content: formContent.trim() || undefined, noticeDate: formDate }),
    });
    setSaving(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setSaveError(j.error ?? '등록 실패'); return; }
    setShowForm(false); setFormTitle(''); setFormContent('');
    load(filterDate);
  }

  function openEdit(n: Notice) {
    setEditingNotice(n);
    setEditAlertType(n.alertType);
    setEditTitle(n.title);
    setEditContent(n.content ?? '');
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNotice || !editTitle.trim()) { setEditError('제목을 입력하세요.'); return; }
    setEditSaving(true); setEditError(null);
    const r = await fetch(`/api/safety/weather-notices/${editingNotice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType: editAlertType, title: editTitle.trim(), content: editContent.trim() || null }),
    });
    setEditSaving(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setEditError(j.error ?? '수정 실패'); return; }
    setEditingNotice(null);
    load(filterDate);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 공지를 삭제하시겠습니까? 연결된 근로자 사진 기록도 함께 삭제됩니다.')) return;
    setDeletingId(id);
    const r = await fetch(`/api/safety/weather-notices/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (!r.ok) { alert('삭제에 실패했습니다.'); return; }
    if (selectedNotice?.id === id) setSelectedNotice(null);
    load(filterDate);
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-ink">날씨관리대장</h2>
          <p className="text-sm font-bold text-ink-muted mt-1">폭염·한파 등 기상 안전 — 근로자 기록 조회 및 Excel 출력</p>
        </div>
        <button onClick={() => { setShowForm((v) => !v); setSaveError(null); }}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 flex-shrink-0">
          {showForm ? '취소' : '+ 공지 등록'}
        </button>
      </div>

      {/* 공지 등록 폼 */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border-2 border-accent rounded-xl p-5 space-y-3">
          <div className="text-sm font-extrabold text-ink">새 기상 안전 공지 등록</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-extrabold text-ink-muted">경보 유형</label>
              <select value={formAlertType} onChange={(e) => setFormAlertType(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-extrabold text-ink-muted">공지 날짜</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-extrabold text-ink-muted">제목 *</label>
            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
              placeholder="예: 6월 10일 폭염주의보 발령"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-extrabold text-ink-muted">내용 (선택)</label>
            <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)}
              placeholder="근로자에게 전달할 안전 조치 내용을 입력하세요."
              rows={3} maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm resize-y focus:outline-none focus:border-accent" />
          </div>
          {saveError && <p className="text-sm font-bold text-red-600">{saveError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50">
              {saving ? '등록 중…' : '등록'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-line text-sm font-bold hover:bg-surface-soft">
              취소
            </button>
          </div>
        </form>
      )}

      {/* 날짜 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent" />
        <span className="text-sm font-mono text-ink-muted">{notices.length}건</span>
        <a
          href={`/safety/weather-notices/print?from=${filterDate}&to=${filterDate}`}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 ml-auto"
        >
          🖨 일자별 출력
        </a>
        <a
          href="/safety/weather-notices/print"
          className="px-3 py-1.5 rounded-lg border border-line bg-white text-sm font-bold hover:bg-slate-50"
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
                {n.content && <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{n.content}</div>}
                <div className="text-[0.6875rem] font-mono text-ink-muted mt-1">
                  {n.noticeDate} · {n.createdBy} 등록 · <span className="font-bold text-accent">기록 {n.photoCount}명</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5">
                <button onClick={() => openRecords(n)}
                  className="px-3 py-1.5 rounded-lg border border-line text-sm font-extrabold hover:bg-surface-soft">
                  기록 보기
                </button>
                <button onClick={() => openEdit(n)}
                  className="px-2.5 py-1.5 rounded-lg border border-line text-sm font-extrabold hover:bg-surface-soft text-accent">
                  수정
                </button>
                <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id}
                  className="px-2.5 py-1.5 rounded-lg border border-red-300 text-sm font-extrabold hover:bg-red-50 text-danger disabled:opacity-40">
                  {deletingId === n.id ? '…' : '삭제'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 공지 수정 모달 */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4" onClick={() => setEditingNotice(null)}>
          <div className="w-full max-w-lg bg-surface rounded-xl shadow-modal p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-base font-extrabold text-ink">공지 수정</div>
              <button onClick={() => setEditingNotice(null)} className="text-2xl font-bold text-ink-muted">×</button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-ink-muted">경보 유형</label>
                  <select value={editAlertType} onChange={(e) => setEditAlertType(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                    {ALERT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-extrabold text-ink-muted">공지 날짜</label>
                  <div className="px-2.5 py-2 rounded-lg border border-line text-sm font-bold bg-surface-soft text-ink-muted">
                    {editingNotice.noticeDate}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-ink-muted">제목 *</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-extrabold text-ink-muted">내용 (선택)</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                  rows={3} maxLength={2000}
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm resize-y focus:outline-none focus:border-accent" />
              </div>
              {editError && <p className="text-sm font-bold text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={editSaving}
                  className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50">
                  {editSaving ? '저장 중…' : '저장'}
                </button>
                <button type="button" onClick={() => setEditingNotice(null)}
                  className="px-4 py-2 rounded-lg border border-line text-sm font-bold hover:bg-surface-soft">
                  취소
                </button>
              </div>
            </form>
          </div>
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
                <div className="text-sm font-mono text-ink-muted mt-0.5">{selectedNotice.noticeDate} · {records.length}명 기록</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport(selectedNotice.id, false)} disabled={exporting}
                  className="px-3 py-1.5 rounded-lg border border-line text-sm font-extrabold hover:bg-surface-soft disabled:opacity-50">
                  📊 Excel (텍스트)
                </button>
                <button onClick={() => handleExport(selectedNotice.id, true)} disabled={exporting}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 disabled:opacity-50">
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
                  <table className="w-full text-sm min-w-[700px]">
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
