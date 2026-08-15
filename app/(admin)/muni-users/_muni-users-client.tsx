'use client';

import { useEffect, useState } from 'react';

type MuniUser = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string;
};

export default function MuniUsersClient() {
  const [items, setItems] = useState<MuniUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ username: '', name: '', phone: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<{ for: string; value: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/muni-users');
    if (res.ok) {
      const body = await res.json();
      setItems(body.items);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/muni-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          name: form.name,
          phone: form.phone || undefined,
          password: form.password || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        if (body.generatedPassword) setIssuedPassword({ for: form.username, value: body.generatedPassword });
        setForm({ username: '', name: '', phone: '', password: '' });
        await load();
      } else if (body.error === 'username_taken') {
        setError('이미 사용 중인 아이디입니다.');
      } else {
        setError('생성 실패: ' + (body.error ?? '알 수 없는 오류'));
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(u: MuniUser) {
    if (!confirm(`${u.name}(${u.username})의 비밀번호를 재설정할까요?`)) return;
    const res = await fetch(`/api/muni-users/${u.id}/password`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.generatedPassword) {
      setIssuedPassword({ for: u.username, value: body.generatedPassword });
    } else if (!res.ok) {
      alert('재설정 실패: ' + (body.error ?? '알 수 없는 오류'));
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="text-sm font-extrabold text-ink mb-4">👥 지자체사용자 계정 생성</h2>
        <form onSubmit={submitCreate} className="space-y-3">
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">아이디</span>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">이름</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">연락처 (선택)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">비밀번호 (비워두면 자동생성)</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>
          )}
          <button
            type="submit"
            disabled={creating || !form.username || !form.name}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {creating ? '생성 중…' : '계정 생성'}
          </button>
        </form>
      </div>

      {issuedPassword && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-800 flex items-center justify-between gap-3">
          <span>✅ {issuedPassword.for} 임시 비밀번호: <span className="font-mono">{issuedPassword.value}</span> (지금만 표시됩니다 — 담당자에게 즉시 전달하세요)</span>
          <button onClick={() => setIssuedPassword(null)} className="text-emerald-700 font-extrabold">닫기</button>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="text-sm font-extrabold text-ink mb-4">지자체사용자 목록</h2>
        {loading ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">등록된 지자체사용자가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {items.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line">
                <div>
                  <div className="text-sm font-extrabold text-ink">{u.name} <span className="text-ink-muted font-mono font-normal">({u.username})</span></div>
                  <div className="text-[0.6875rem] text-ink-muted">{u.phone ?? '연락처 미등록'} · {u.status}</div>
                </div>
                <button
                  onClick={() => resetPassword(u)}
                  className="px-3 py-1.5 rounded-lg border-2 border-line text-xs font-extrabold hover:bg-surface-alt active:scale-95"
                >
                  🔑 비밀번호 재설정
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
