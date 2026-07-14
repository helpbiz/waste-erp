'use client';

import { useEffect, useState } from 'react';

type Category = { id: string; label: string; isActive: boolean; sortOrder: number };

export default function IntakeCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/intake-categories');
    const j = await r.json();
    setItems(j.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch('/api/admin/intake-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), sortOrder: items.length }),
    });
    setSaving(false);
    if (r.ok) { setNewLabel(''); load(); }
    else {
      const j = await r.json().catch(() => ({}));
      setError(j.error === 'already_exists' ? '이미 등록된 성상입니다.' : '추가 실패');
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/intake-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return;
    await fetch(`/api/admin/intake-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim() }),
    });
    setEditId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('삭제하면 복구할 수 없습니다. 계속할까요?')) return;
    await fetch(`/api/admin/intake-categories/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">반입입력 성상 설정</h2>
        <p className="text-sm text-ink-muted mt-1">
          실적관리 &gt; 반입입력에서 선택할 성상(폐기물 종류) 목록을 관리합니다.
        </p>
      </div>

      {/* 직접 추가 */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
        <div className="text-sm font-extrabold text-ink">성상 추가</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="예: 생활, 기동, 대형폐기물"
            maxLength={20}
            className="flex-1 px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
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

      {/* 목록 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-surface-soft text-sm font-extrabold text-ink">
          등록된 성상 ({items.length}개)
        </div>

        {loading && (
          <div className="py-10 text-center text-sm text-ink-muted">로딩 중…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-10 text-center text-sm text-ink-muted font-bold">
            아직 등록된 성상이 없습니다.<br />
            <span className="text-sm">위에서 추가하세요.</span>
          </div>
        )}

        {items.map((c, idx) => (
          <div key={c.id} className={`flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 ${
            !c.isActive ? 'opacity-50' : ''
          }`}>
            <span className="text-sm font-mono text-ink-muted w-5 text-right">{idx + 1}</span>

            {editId === c.id ? (
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditId(null); }}
                placeholder="이름"
                className="flex-1 px-2 py-1 rounded border-2 border-accent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              />
            ) : (
              <div className="flex-1 min-w-0 text-sm font-bold text-ink">{c.label}</div>
            )}

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {editId === c.id ? (
                <>
                  <button onClick={() => saveEdit(c.id)} className="px-2 py-1 rounded bg-accent text-white text-sm font-bold">저장</button>
                  <button onClick={() => setEditId(null)} className="px-2 py-1 rounded bg-slate-200 text-ink text-sm font-bold">취소</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`px-2 py-1 rounded text-sm font-bold ${
                      c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink-faint'
                    }`}
                  >
                    {c.isActive ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => { setEditId(c.id); setEditLabel(c.label); }}
                    className="px-2 py-1 rounded bg-slate-100 text-ink-muted text-sm font-bold hover:bg-slate-200"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(c.id)}
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
