'use client';

import { useEffect, useState } from 'react';

type Schedule = { id: string; label: string; timeOfDay: string; isActive: boolean; sortOrder: number };

const MAX_ACTIVE = 5;

export default function TbmSchedulesPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editTime, setEditTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/tbm-schedules');
    const j = await r.json();
    setItems(j.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const activeCount = items.filter((s) => s.isActive).length;

  async function add() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch('/api/admin/tbm-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), timeOfDay: newTime, sortOrder: items.length }),
    });
    setSaving(false);
    if (r.ok) { setNewLabel(''); load(); }
    else {
      const j = await r.json().catch(() => ({}));
      setError(
        j.error === 'already_exists' ? '이미 등록된 이름입니다.'
        : j.error === 'schedule_limit_reached' ? `활성 TBM 시간대는 최대 ${MAX_ACTIVE}개까지 등록할 수 있습니다.`
        : '추가 실패'
      );
    }
  }

  async function toggleActive(s: Schedule) {
    const r = await fetch(`/api/admin/tbm-schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j.error === 'schedule_limit_reached') {
        setError(`활성 TBM 시간대는 최대 ${MAX_ACTIVE}개까지 등록할 수 있습니다.`);
        return;
      }
    }
    load();
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return;
    await fetch(`/api/admin/tbm-schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim(), timeOfDay: editTime }),
    });
    setEditId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('삭제하면 복구할 수 없습니다. 계속할까요?')) return;
    await fetch(`/api/admin/tbm-schedules/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">TBM 시간 설정</h2>
        <p className="text-sm text-ink-muted mt-1">
          하루 여러 차례 TBM 공지를 등록할 시간대를 관리합니다. (활성 {activeCount}/{MAX_ACTIVE})
        </p>
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
        <div className="text-sm font-extrabold text-ink">시간대 추가</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="예: 오전 TBM, 오후 TBM"
            maxLength={30}
            className="flex-1 px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="px-3 py-2 rounded-lg border-2 border-line text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
          />
          <button
            disabled={!newLabel.trim() || saving}
            onClick={add}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-surface-soft text-sm font-extrabold text-ink">
          등록된 시간대 ({items.length}개)
        </div>

        {loading && <div className="py-10 text-center text-sm text-ink-muted">로딩 중…</div>}
        {!loading && items.length === 0 && (
          <div className="py-10 text-center text-sm text-ink-muted font-bold">
            아직 등록된 시간대가 없습니다.<br />
            <span className="text-sm">위에서 추가하세요.</span>
          </div>
        )}

        {items.map((s, idx) => (
          <div key={s.id} className={`flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 ${
            !s.isActive ? 'opacity-50' : ''
          }`}>
            <span className="text-sm font-mono text-ink-muted w-5 text-right">{idx + 1}</span>

            {editId === s.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null); }}
                  className="flex-1 px-2 py-1 rounded border-2 border-accent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="px-2 py-1 rounded border border-line text-sm font-mono"
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-ink">{s.label}</span>
                <span className="ml-2 text-sm font-mono text-ink-muted">{s.timeOfDay}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {editId === s.id ? (
                <>
                  <button onClick={() => saveEdit(s.id)} className="px-2 py-1 rounded bg-accent text-white text-sm font-bold">저장</button>
                  <button onClick={() => setEditId(null)} className="px-2 py-1 rounded bg-slate-200 text-ink text-sm font-bold">취소</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-2 py-1 rounded text-sm font-bold ${
                      s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink-faint'
                    }`}
                  >
                    {s.isActive ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => { setEditId(s.id); setEditLabel(s.label); setEditTime(s.timeOfDay); }}
                    className="px-2 py-1 rounded bg-slate-100 text-ink-muted text-sm font-bold hover:bg-slate-200"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-bold hover:bg-red-200"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
