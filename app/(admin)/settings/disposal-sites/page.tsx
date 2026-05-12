'use client';

import { useEffect, useState } from 'react';

type Site = { id: string; name: string; isActive: boolean; sortOrder: number };

const PRESETS = ['매립지', '처리장', '소각장', '압축기', '연계작업'];

export default function DisposalSitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/disposal-sites');
    const j = await r.json();
    setItems(j.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add(name: string) {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch('/api/admin/disposal-sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), sortOrder: items.length }),
    });
    setSaving(false);
    if (r.ok) { setNewName(''); load(); }
    else {
      const j = await r.json().catch(() => ({}));
      setError(j.error === 'already_exists' ? '이미 등록된 이름입니다.' : '추가 실패');
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/disposal-sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/admin/disposal-sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('삭제하면 복구할 수 없습니다. 계속할까요?')) return;
    await fetch(`/api/admin/disposal-sites/${id}`, { method: 'DELETE' });
    load();
  }

  const existingNames = new Set(items.map((s) => s.name));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">반입장소 설정</h2>
        <p className="text-sm text-ink-muted mt-1">
          차량일지 작업내역에서 선택할 반입장소 목록을 관리합니다.
        </p>
      </div>

      {/* 빠른 추가 — 기본 제안 */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
        <div className="text-sm font-extrabold text-ink">기본 제안</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              disabled={existingNames.has(p) || saving}
              onClick={() => add(p)}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold transition
                disabled:opacity-40 disabled:cursor-not-allowed
                enabled:bg-surface enabled:border-line enabled:text-ink enabled:hover:bg-accent enabled:hover:text-white enabled:hover:border-accent"
            >
              {existingNames.has(p) ? `✓ ${p}` : `+ ${p}`}
            </button>
          ))}
        </div>
      </div>

      {/* 직접 추가 */}
      <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
        <div className="text-sm font-extrabold text-ink">직접 추가</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add(newName)}
            placeholder="반입장소 이름 입력 (예: 자원순환센터)"
            maxLength={50}
            className="flex-1 px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
          />
          <button
            disabled={!newName.trim() || saving}
            onClick={() => add(newName)}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
      </div>

      {/* 목록 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-surface-soft text-sm font-extrabold text-ink">
          등록된 반입장소 ({items.length}개)
        </div>

        {loading && (
          <div className="py-10 text-center text-sm text-ink-muted">로딩 중…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-10 text-center text-sm text-ink-muted font-bold">
            아직 등록된 반입장소가 없습니다.<br />
            <span className="text-xs">위 기본 제안 또는 직접 추가로 등록하세요.</span>
          </div>
        )}

        {items.map((site, idx) => (
          <div key={site.id} className={`flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 ${
            !site.isActive ? 'opacity-50' : ''
          }`}>
            <span className="text-xs font-mono text-ink-muted w-5 text-right">{idx + 1}</span>

            {editId === site.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(site.id); if (e.key === 'Escape') setEditId(null); }}
                className="flex-1 px-2 py-1 rounded border-2 border-accent text-sm focus:outline-none"
              />
            ) : (
              <span className="flex-1 text-sm font-bold text-ink">{site.name}</span>
            )}

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {editId === site.id ? (
                <>
                  <button onClick={() => saveEdit(site.id)} className="px-2 py-1 rounded bg-accent text-white text-xs font-bold">저장</button>
                  <button onClick={() => setEditId(null)} className="px-2 py-1 rounded bg-slate-200 text-ink text-xs font-bold">취소</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleActive(site.id, site.isActive)}
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      site.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {site.isActive ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => { setEditId(site.id); setEditName(site.name); }}
                    className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(site.id)}
                    className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
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
