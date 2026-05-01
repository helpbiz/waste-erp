'use client';

import { useEffect, useState } from 'react';

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  audience: 'ALL' | 'ADMIN' | 'WORKER' | 'MUNI';
  pinned: boolean;
  publishedAt: string;
  updatedAt: string;
  edited: boolean;
  expiresAt: string | null;
  authorName: string;
};

const SEV_LABEL = { INFO: '안내', WARNING: '주의', CRITICAL: '긴급' };
const AUD_LABEL = { ALL: '전체', ADMIN: '관리자', WORKER: '근로자', MUNI: '지자체' };

const SEV_TONE: Record<string, string> = {
  INFO:     'border-cyan-400 bg-cyan-50 text-cyan-900',
  WARNING:  'border-amber-400 bg-amber-50 text-amber-900',
  CRITICAL: 'border-rose-500 bg-rose-50 text-rose-900',
};

export default function AnnouncementsClient({ session }: { session: { name: string; role: string } }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/announcements?admin=true&includeExpired=true')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function del(id: string, title: string) {
    if (!confirm(`⚠ 공지 삭제\n\n'${title}'\n\n이 공지를 영구 삭제합니다. 복구 불가.\n진행하시겠습니까?`)) return;
    const r = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    if (r.ok) load();
    else {
      const j = await r.json().catch(() => ({}));
      alert('실패: ' + (j.error ?? 'unknown'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-extrabold text-ink">📢 공지사항</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
          {session.role === 'SUPER_ADMIN' ? '🌐 시스템 전체 공지 가능' :
           session.role === 'CONTRACTOR_ADMIN' ? '🏢 회사 대표 — 회사 내부 공지 작성·관리' :
           session.role === 'INTERNAL_ADMIN' ? '👔 관리자 — 회사 내부 공지 작성·관리' : ''}
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md active:scale-95"
        >
          ＋ 신규 공지 작성
        </button>
      </div>

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />}
      {editTarget && <CreateModal initial={editTarget} onClose={() => setEditTarget(null)} onCreated={() => { setEditTarget(null); load(); }} />}

      {loading && <div className="text-center py-10 text-slate-500">로딩 중…</div>}
      {!loading && items.length === 0 && (
        <div className="bg-surface border border-line rounded-lg py-16 text-center text-slate-500 font-bold">
          등록된 공지가 없습니다. [＋ 신규 공지 작성] 클릭하여 첫 공지를 등록하세요.
        </div>
      )}

      <div className="space-y-3">
        {items.map((a) => {
          const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
          return (
            <article key={a.id} className={`border-2 rounded-lg p-4 ${SEV_TONE[a.severity]} ${expired ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {a.pinned && <span className="text-[0.6875rem] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white">📌 고정</span>}
                    <span className="text-[0.6875rem] font-extrabold px-1.5 py-0.5 rounded bg-white border border-current">
                      {SEV_LABEL[a.severity]}
                    </span>
                    <span className="text-[0.6875rem] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {AUD_LABEL[a.audience]}
                    </span>
                    {expired && <span className="text-[0.6875rem] font-extrabold px-1.5 py-0.5 rounded bg-slate-300 text-slate-700">만료</span>}
                  </div>
                  <h3 className="text-base font-black text-ink">{a.title}</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1.5 leading-relaxed">{a.body}</p>
                  <div className="text-[0.6875rem] font-mono text-slate-500 mt-2 flex items-center gap-1.5 flex-wrap">
                    <span>{a.authorName}</span>
                    <span>·</span>
                    <span>{new Date(a.publishedAt).toLocaleString('ko-KR')}</span>
                    {a.edited && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[0.625rem] font-extrabold">
                        ✏ 수정됨 {new Date(a.updatedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {a.expiresAt && <span>· 만료: {new Date(a.expiresAt).toLocaleDateString('ko-KR')}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditTarget(a)}
                    className="px-2.5 py-1 rounded text-xs font-extrabold bg-cyan-600 hover:bg-cyan-700 text-white active:scale-95"
                  >
                    ✏ 수정
                  </button>
                  <button
                    onClick={() => del(a.id, a.title)}
                    className="px-2.5 py-1 rounded text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white active:scale-95"
                  >
                    🗑 삭제
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CreateModal({ initial, onClose, onCreated }: { initial?: Announcement; onClose: () => void; onCreated: () => void }) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>(initial?.severity ?? 'INFO');
  const [audience, setAudience] = useState<'ALL' | 'ADMIN' | 'WORKER' | 'MUNI'>(initial?.audience ?? 'ALL');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? initial.expiresAt.slice(0, 10) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim()) return setError('제목 필수');
    if (!body.trim()) return setError('내용 필수');
    setBusy(true);
    const url = isEdit ? `/api/announcements/${initial.id}` : '/api/announcements';
    const method = isEdit ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim(),
        severity,
        audience,
        pinned,
        expiresAt: expiresAt ? new Date(expiresAt + 'T23:59:59').toISOString() : null,
      }),
    });
    setBusy(false);
    if (r.ok) onCreated();
    else setError((await r.json().catch(() => ({}))).error ?? '실패');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[600px] w-full max-h-[92vh] flex flex-col">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-black text-ink">{isEdit ? '✏ 공지 수정' : '📢 신규 공지 작성'}</h2>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">제목 *</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              className="w-full px-3 py-2 rounded border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">내용 *</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={10000}
              className="w-full px-3 py-2 rounded border-2 border-line text-sm focus:outline-none focus:border-accent" />
            <div className="text-[0.625rem] text-slate-500 mt-0.5">{body.length}/10000자</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-extrabold text-ink mb-1">중요도</div>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as 'INFO'|'WARNING'|'CRITICAL')}
                className="w-full px-3 py-2 rounded border-2 border-line text-sm">
                <option value="INFO">📘 안내 (INFO)</option>
                <option value="WARNING">⚠ 주의 (WARNING)</option>
                <option value="CRITICAL">🚨 긴급 (CRITICAL)</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-extrabold text-ink mb-1">대상</div>
              <select value={audience} onChange={(e) => setAudience(e.target.value as 'ALL'|'ADMIN'|'WORKER'|'MUNI')}
                className="w-full px-3 py-2 rounded border-2 border-line text-sm">
                <option value="ALL">👥 전체 (모든 사용자)</option>
                <option value="ADMIN">🛠 관리자만</option>
                <option value="WORKER">👷 근로자만</option>
                <option value="MUNI">🏛 지자체만</option>
              </select>
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">만료일 (선택, 비워두면 영구)</div>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="px-3 py-2 rounded border-2 border-line text-sm font-mono" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <span className="text-sm font-bold text-ink">📌 상단 고정 (다른 공지보다 위에 표시)</span>
          </label>
          {error && <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-xs font-bold text-red-700">⚠ {error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 rounded border border-line text-sm font-bold">취소</button>
          <button onClick={submit} disabled={busy} className="px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? (isEdit ? '저장 중…' : '게시 중…') : (isEdit ? '✓ 수정 저장' : '✓ 공지 게시')}
          </button>
        </div>
      </div>
    </div>
  );
}
