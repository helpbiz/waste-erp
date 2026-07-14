'use client';

import { useEffect, useState } from 'react';

type Manager = { id: string; name: string; role: string };
type Worker = { id: string; name: string; employeeNo: string | null };

export default function TbmAudiencePage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [managerId, setManagerId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/tbm-managers').then((r) => r.json()).then((d) => {
      const items: Manager[] = d.items ?? [];
      setManagers(items);
      setManagerId((prev) => prev || items[0]?.id || '');
    });
    fetch('/api/users?role=WORKER&status=ACTIVE').then((r) => r.json()).then((d) => {
      setWorkers((d.items ?? []).map((u: { id: string; name: string; employeeNo: string | null }) => ({
        id: u.id, name: u.name, employeeNo: u.employeeNo,
      })));
    });
  }, []);

  useEffect(() => {
    if (!managerId) { setSelected(new Set()); return; }
    setLoading(true);
    fetch(`/api/admin/tbm-audience?managerId=${managerId}`)
      .then((r) => r.json())
      .then((d) => setSelected(new Set<string>(d.workerIds ?? [])))
      .finally(() => setLoading(false));
  }, [managerId]);

  function toggle(workerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId); else next.add(workerId);
      return next;
    });
  }

  async function save() {
    if (!managerId) return;
    setSaving(true);
    setMessage(null);
    const r = await fetch('/api/admin/tbm-audience', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId, workerIds: Array.from(selected) }),
    });
    setSaving(false);
    setMessage(r.ok ? '저장되었습니다.' : '저장 실패');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">TBM 서명대상 설정</h2>
        <p className="text-sm text-ink-muted mt-1">
          등록권한자별로 TBM 공지 시 서명 대상이 될 근로자를 미리 지정합니다.
          지정하지 않은 등록권한자는 기존처럼 전체 근로자가 대상이 됩니다.
        </p>
      </div>

      {managers.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center text-sm font-bold text-ink-muted">
          TBM 등록권한자가 없습니다. 사용자관리에서 먼저 &quot;TBM 작성 권한&quot;을 부여하세요.
        </div>
      ) : (
        <>
          <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
            <div className="text-sm font-extrabold text-ink">등록권한자 선택</div>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
            >
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-surface-soft flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink">서명 대상 근로자 ({selected.size}/{workers.length}명 선택)</span>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(workers.map((w) => w.id)))} className="text-sm font-bold text-accent">전체선택</button>
                <button onClick={() => setSelected(new Set())} className="text-sm font-bold text-ink-muted">전체해제</button>
              </div>
            </div>
            {loading ? (
              <div className="py-10 text-center text-sm text-ink-muted">로딩 중…</div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-line">
                {workers.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-surface-soft">
                    <input
                      type="checkbox"
                      checked={selected.has(w.id)}
                      onChange={() => toggle(w.id)}
                      className="w-4 h-4 rounded border-2 border-line accent-accent"
                    />
                    <span className="text-sm font-bold text-ink">{w.name}</span>
                    {w.employeeNo && <span className="text-sm font-mono text-ink-faint">{w.employeeNo}</span>}
                  </label>
                ))}
                {workers.length === 0 && (
                  <div className="py-10 text-center text-sm text-ink-muted font-bold">등록된 근로자가 없습니다.</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !managerId}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            {message && <span className="text-sm font-bold text-ink-muted">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}
