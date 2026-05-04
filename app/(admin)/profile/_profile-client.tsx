'use client';

import { useState } from 'react';

export default function AdminProfileClient({ name, role }: { name: string; role: string }) {
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (pw.next.length < 6) { setError('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (pw.next !== pw.confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/worker/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      if (res.ok) {
        setDone(true);
        setPw({ current: '', next: '', confirm: '' });
      } else {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'incorrect_password') setError('현재 비밀번호가 올바르지 않습니다.');
        else setError('변경 실패: ' + (body.error ?? '알 수 없는 오류'));
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-5">
      {/* 계정 정보 */}
      <div className="bg-surface border border-line rounded-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0">
          {name.charAt(0)}
        </div>
        <div>
          <div className="text-base font-extrabold text-ink">{name}</div>
          <div className="text-xs font-mono font-bold text-ink-muted mt-0.5">{role}</div>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="text-sm font-extrabold text-ink mb-4">🔑 비밀번호 변경</h2>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">현재 비밀번호</span>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              autoComplete="current-password"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">새 비밀번호 (6자 이상)</span>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              autoComplete="new-password"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-extrabold text-ink-muted mb-1">새 비밀번호 확인</span>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              autoComplete="new-password"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {error}
            </div>
          )}
          {done && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              ✅ 비밀번호가 변경되었습니다.
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !pw.current || !pw.next || !pw.confirm}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
