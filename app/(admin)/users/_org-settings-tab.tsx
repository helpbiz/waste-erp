'use client';

// Design Ref: §6 — 직책·직급 관리 UI. Plan SC: FR-07
import { useState, useEffect, useCallback } from 'react';

type PosRow = { id: string; name: string; category: string; sortOrder: number; active: boolean; userCount: number };
type RankRow = { id: string; name: string; level: number; sortOrder: number; active: boolean; userCount: number };
type DeptRow = { id: string; name: string; sortOrder: number; parentId: string | null; excludeFromTbm: boolean; headUserId: string | null; headUserName: string | null };
type WorkerOpt = { id: string; name: string };
type SubTab = 'positions' | 'ranks' | 'departments';

const CATEGORY_LABEL: Record<string, string> = { MANAGER: '관리자', FIELD: '현장', ADMIN: '임원·사무' };
const CATEGORY_OPTIONS = ['MANAGER', 'FIELD', 'ADMIN'] as const;

export default function OrgSettingsTab() {
  const [sub, setSub] = useState<SubTab>('departments');
  const [positions, setPositions] = useState<PosRow[]>([]);
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pr, rr, dr, wr] = await Promise.all([
        fetch('/api/contractor/positions?active=all').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetch('/api/contractor/ranks?active=all').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetch('/api/departments').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetch('/api/users?role=WORKER&status=ACTIVE').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).catch(() => ({})),
      ]);
      setPositions(pr.positions ?? []);
      setRanks(rr.ranks ?? []);
      setDepartments(dr.departments ?? []);
      setWorkers((wr.items ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
    } catch {
      setError('불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-line">
        <SubTabBtn active={sub === 'departments'} onClick={() => setSub('departments')}>부서 관리</SubTabBtn>
        <SubTabBtn active={sub === 'positions'} onClick={() => setSub('positions')}>직책 관리</SubTabBtn>
        <SubTabBtn active={sub === 'ranks'} onClick={() => setSub('ranks')}>직급 관리</SubTabBtn>
      </div>

      {loading && <p className="text-sm text-ink-faint py-4 text-center">불러오는 중…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && sub === 'departments' && (
        <DepartmentsPanel rows={departments} workers={workers} onRefresh={load} />
      )}
      {!loading && sub === 'positions' && (
        <PositionsPanel rows={positions} onRefresh={load} />
      )}
      {!loading && sub === 'ranks' && (
        <RanksPanel rows={ranks} onRefresh={load} />
      )}
    </div>
  );
}

function SubTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
        active ? 'border-primary text-primary' : 'border-transparent text-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── Departments Panel ─────────────────────────── */

function DepartmentsPanel({ rows, workers, onRefresh }: { rows: DeptRow[]; workers: WorkerOpt[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [addForm, setAddForm] = useState({ name: '', sortOrder: 0 });

  async function handleAdd() {
    setSubmitting(true); setErrMsg('');
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setSubmitting(false);
    if (res.status === 409) { setErrMsg('같은 이름의 부서가 이미 있습니다'); return; }
    if (!res.ok) { setErrMsg('추가 실패'); return; }
    setShowAdd(false);
    setAddForm({ name: '', sortOrder: 0 });
    onRefresh();
  }

  async function handleSave(id: string, data: { name?: string; sortOrder?: number; excludeFromTbm?: boolean; headUserId?: string | null }) {
    await fetch(`/api/departments/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    setEditId(null);
    onRefresh();
  }

  async function handleDelete(row: DeptRow) {
    if (!confirm(`"${row.name}" 부서를 삭제(비활성화)하시겠습니까?\n소속 사용자가 없을 때만 가능합니다.`)) return;
    const res = await fetch(`/api/departments/${row.id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const j = await res.json();
      alert(`삭제 불가: 소속 사용자 ${j.users}명 또는 하위 부서가 있습니다.`);
      return;
    }
    onRefresh();
  }

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm text-ink-faint">부서 {rows.length}개</span>
          <span className="text-sm text-ink-faint ml-2">· 출근대장 인쇄 순서는 표시순서(숫자)에 따라 적용됩니다</span>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-1.5 rounded-md text-sm font-bold bg-primary text-white hover:bg-primary/90"
        >+ 부서 추가</button>
      </div>

      {showAdd && (
        <div className="border border-line rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <input
              className="border border-line rounded px-2 py-1 text-sm flex-1 min-w-[140px]"
              placeholder="부서명 (예: 생활폐기물)"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <input
              type="number"
              className="border border-line rounded px-2 py-1 text-sm w-24"
              placeholder="표시순서"
              value={addForm.sortOrder}
              onChange={(e) => setAddForm({ ...addForm, sortOrder: Number(e.target.value) })}
            />
          </div>
          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={submitting || !addForm.name}
              className="px-3 py-1.5 rounded text-sm font-bold bg-primary text-white disabled:opacity-40">저장</button>
            <button onClick={() => { setShowAdd(false); setErrMsg(''); }}
              className="px-3 py-1.5 rounded text-sm font-bold border border-line text-ink-faint">취소</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-sm text-ink-faint">
              <th className="px-3 py-2 text-center font-semibold w-16">순서</th>
              <th className="px-3 py-2 text-left font-semibold">부서명</th>
              <th className="px-3 py-2 text-center font-semibold w-24">TBM 대상</th>
              <th className="px-3 py-2 text-left font-semibold min-w-[160px]">TBM 담당자</th>
              <th className="px-3 py-2 text-center font-semibold w-24">작업</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-t border-line">
                {editId === row.id ? (
                  <EditDeptRow row={row} onSave={(d) => handleSave(row.id, d)} onCancel={() => setEditId(null)} colSpan={5} />
                ) : (
                  <>
                    <td className="px-3 py-2 text-center font-mono text-ink-faint">{row.sortOrder}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSave(row.id, { excludeFromTbm: !row.excludeFromTbm })}
                        className={`px-2 py-0.5 rounded text-sm font-semibold border ${
                          row.excludeFromTbm
                            ? 'bg-slate-100 text-ink-faint border-slate-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}
                        title={row.excludeFromTbm ? '클릭하면 TBM 대상으로 변경' : '클릭하면 TBM 제외로 변경'}
                      >
                        {row.excludeFromTbm ? '제외' : '대상'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {/* TBM 담당자 인라인 선택 드롭다운 */}
                      <select
                        value={row.headUserId ?? ''}
                        onChange={(e) => handleSave(row.id, { headUserId: e.target.value || null })}
                        className="w-full px-2 py-1 rounded border border-line text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent"
                        disabled={row.excludeFromTbm}
                        title={row.excludeFromTbm ? 'TBM 제외 부서는 담당자 지정 불가' : 'TBM 담당자 선택'}
                      >
                        <option value="">— 미지정 —</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                      {row.headUserName && (
                        <div className="text-[0.625rem] text-emerald-700 font-semibold mt-0.5">✓ {row.headUserName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setEditId(row.id)}
                          className="px-2 py-0.5 rounded text-sm border border-line hover:bg-slate-50">수정</button>
                        <button onClick={() => handleDelete(row)}
                          className="px-2 py-0.5 rounded text-sm border border-red-200 text-red-600 hover:bg-red-50">삭제</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-faint text-sm">등록된 부서가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditDeptRow({ row, onSave, onCancel, colSpan: _cs }: { row: DeptRow; onSave: (d: { name: string; sortOrder: number; excludeFromTbm: boolean }) => void; onCancel: () => void; colSpan?: number }) {
  const [name, setName] = useState(row.name);
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  const [excludeFromTbm, setExcludeFromTbm] = useState(row.excludeFromTbm);
  return (
    <>
      <td className="px-3 py-1 text-center">
        <input type="number" className="border border-line rounded px-1 py-0.5 text-sm w-16" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
      </td>
      <td className="px-3 py-1">
        <input className="border border-line rounded px-2 py-0.5 text-sm w-full" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="px-3 py-1 text-center">
        <button
          type="button"
          onClick={() => setExcludeFromTbm((v) => !v)}
          className={`px-2 py-0.5 rounded text-sm font-semibold border ${excludeFromTbm ? 'bg-slate-100 text-ink-faint border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}
        >
          {excludeFromTbm ? '제외' : '대상'}
        </button>
      </td>
      {/* TBM 담당자는 인라인 드롭다운으로 처리 — 수정 행에서는 빈 셀 */}
      <td className="px-3 py-1 text-sm text-ink-faint italic">인라인 드롭다운으로 변경</td>
      <td className="px-3 py-1">
        <div className="flex gap-1 justify-center">
          <button onClick={() => onSave({ name, sortOrder, excludeFromTbm })} className="px-2 py-0.5 rounded text-sm bg-primary text-white">저장</button>
          <button onClick={onCancel} className="px-2 py-0.5 rounded text-sm border border-line">취소</button>
        </div>
      </td>
    </>
  );
}

/* ─────────────────────────── Positions Panel ─────────────────────────── */

function PositionsPanel({ rows, onRefresh }: { rows: PosRow[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const [addForm, setAddForm] = useState({ name: '', category: 'FIELD' as typeof CATEGORY_OPTIONS[number], sortOrder: 900 });

  async function handleAdd() {
    setSubmitting(true); setErrMsg('');
    const res = await fetch('/api/contractor/positions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setSubmitting(false);
    if (res.status === 409) { setErrMsg('같은 이름의 직책이 이미 있습니다'); return; }
    if (!res.ok) { setErrMsg('추가 실패'); return; }
    setShowAdd(false);
    setAddForm({ name: '', category: 'FIELD', sortOrder: 900 });
    onRefresh();
  }

  async function handleToggleActive(row: PosRow) {
    const res = await fetch(`/api/contractor/positions/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    if (res.status === 409) {
      const j = await res.json();
      alert(`사용 중인 직책입니다 (${j.userCount}명 배정). 먼저 사용자 직책을 변경하세요.`);
      return;
    }
    onRefresh();
  }

  async function handleEditSave(row: PosRow, data: Partial<PosRow>) {
    await fetch(`/api/contractor/positions/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    setEditId(null);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-ink-faint">직책 {rows.length}개</span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-1.5 rounded-md text-sm font-bold bg-primary text-white hover:bg-primary/90"
        >+ 직책 추가</button>
      </div>

      {showAdd && (
        <div className="border border-line rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <input
              className="border border-line rounded px-2 py-1 text-sm flex-1 min-w-[120px]"
              placeholder="직책명"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <select
              className="border border-line rounded px-2 py-1 text-sm"
              value={addForm.category}
              onChange={(e) => setAddForm({ ...addForm, category: e.target.value as typeof CATEGORY_OPTIONS[number] })}
            >
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <input
              type="number"
              className="border border-line rounded px-2 py-1 text-sm w-20"
              placeholder="순서"
              value={addForm.sortOrder}
              onChange={(e) => setAddForm({ ...addForm, sortOrder: Number(e.target.value) })}
            />
          </div>
          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={submitting || !addForm.name}
              className="px-3 py-1.5 rounded text-sm font-bold bg-primary text-white disabled:opacity-40">저장</button>
            <button onClick={() => { setShowAdd(false); setErrMsg(''); }}
              className="px-3 py-1.5 rounded text-sm font-bold border border-line text-ink-faint">취소</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-sm text-ink-faint">
              <th className="px-3 py-2 text-left font-semibold">직책명</th>
              <th className="px-3 py-2 text-left font-semibold">구분</th>
              <th className="px-3 py-2 text-center font-semibold">순서</th>
              <th className="px-3 py-2 text-center font-semibold">사용자수</th>
              <th className="px-3 py-2 text-center font-semibold">상태</th>
              <th className="px-3 py-2 text-center font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-t border-line ${!row.active ? 'opacity-50' : ''}`}>
                {editId === row.id ? (
                  <EditPosRow row={row} onSave={(d) => handleEditSave(row, d)} onCancel={() => setEditId(null)} />
                ) : (
                  <>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className="text-sm px-2 py-0.5 rounded-full bg-slate-100 text-ink-faint">{CATEGORY_LABEL[row.category] ?? row.category}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-ink-faint">{row.sortOrder}</td>
                    <td className="px-3 py-2 text-center">{row.userCount}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-semibold ${row.active ? 'text-emerald-600' : 'text-ink-faint'}`}>
                        {row.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setEditId(row.id)}
                          className="px-2 py-0.5 rounded text-sm border border-line hover:bg-slate-50">수정</button>
                        <button onClick={() => handleToggleActive(row)}
                          className={`px-2 py-0.5 rounded text-sm border ${row.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          {row.active ? '비활성화' : '활성화'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-faint text-sm">등록된 직책이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditPosRow({ row, onSave, onCancel }: { row: PosRow; onSave: (d: Partial<PosRow>) => void; onCancel: () => void }) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category);
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  return (
    <>
      <td className="px-3 py-1"><input className="border border-line rounded px-2 py-0.5 text-sm w-full" value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td className="px-3 py-1">
        <select className="border border-line rounded px-1 py-0.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </td>
      <td className="px-3 py-1"><input type="number" className="border border-line rounded px-1 py-0.5 text-sm w-16" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></td>
      <td className="px-3 py-1 text-center">{row.userCount}</td>
      <td className="px-3 py-1 text-center">{row.active ? '활성' : '비활성'}</td>
      <td className="px-3 py-1">
        <div className="flex gap-1 justify-center">
          <button onClick={() => onSave({ name, category, sortOrder })} className="px-2 py-0.5 rounded text-sm bg-primary text-white">저장</button>
          <button onClick={onCancel} className="px-2 py-0.5 rounded text-sm border border-line">취소</button>
        </div>
      </td>
    </>
  );
}

/* ─────────────────────────── Ranks Panel ─────────────────────────── */

function RanksPanel({ rows, onRefresh }: { rows: RankRow[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [addForm, setAddForm] = useState({ name: '', level: 99, sortOrder: 900 });

  async function handleAdd() {
    setSubmitting(true); setErrMsg('');
    const res = await fetch('/api/contractor/ranks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setSubmitting(false);
    if (res.status === 409) { setErrMsg('같은 이름의 직급이 이미 있습니다'); return; }
    if (!res.ok) { setErrMsg('추가 실패'); return; }
    setShowAdd(false);
    setAddForm({ name: '', level: 99, sortOrder: 900 });
    onRefresh();
  }

  async function handleToggleActive(row: RankRow) {
    const res = await fetch(`/api/contractor/ranks/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    if (res.status === 409) {
      const j = await res.json();
      alert(`사용 중인 직급입니다 (${j.userCount}명 배정). 먼저 사용자 직급을 변경하세요.`);
      return;
    }
    onRefresh();
  }

  async function handleEditSave(row: RankRow, data: Partial<RankRow>) {
    await fetch(`/api/contractor/ranks/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    setEditId(null);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-ink-faint">직급 {rows.length}개</span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-1.5 rounded-md text-sm font-bold bg-primary text-white hover:bg-primary/90"
        >+ 직급 추가</button>
      </div>

      {showAdd && (
        <div className="border border-line rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <input
              className="border border-line rounded px-2 py-1 text-sm flex-1 min-w-[120px]"
              placeholder="직급명"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <input
              type="number"
              className="border border-line rounded px-2 py-1 text-sm w-24"
              placeholder="급수(1=최고)"
              value={addForm.level}
              onChange={(e) => setAddForm({ ...addForm, level: Number(e.target.value) })}
            />
            <input
              type="number"
              className="border border-line rounded px-2 py-1 text-sm w-20"
              placeholder="순서"
              value={addForm.sortOrder}
              onChange={(e) => setAddForm({ ...addForm, sortOrder: Number(e.target.value) })}
            />
          </div>
          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={submitting || !addForm.name}
              className="px-3 py-1.5 rounded text-sm font-bold bg-primary text-white disabled:opacity-40">저장</button>
            <button onClick={() => { setShowAdd(false); setErrMsg(''); }}
              className="px-3 py-1.5 rounded text-sm font-bold border border-line text-ink-faint">취소</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-sm text-ink-faint">
              <th className="px-3 py-2 text-left font-semibold">직급명</th>
              <th className="px-3 py-2 text-center font-semibold">급수</th>
              <th className="px-3 py-2 text-center font-semibold">순서</th>
              <th className="px-3 py-2 text-center font-semibold">사용자수</th>
              <th className="px-3 py-2 text-center font-semibold">상태</th>
              <th className="px-3 py-2 text-center font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-t border-line ${!row.active ? 'opacity-50' : ''}`}>
                {editId === row.id ? (
                  <EditRankRow row={row} onSave={(d) => handleEditSave(row, d)} onCancel={() => setEditId(null)} />
                ) : (
                  <>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-center text-ink-faint">{row.level}</td>
                    <td className="px-3 py-2 text-center text-ink-faint">{row.sortOrder}</td>
                    <td className="px-3 py-2 text-center">{row.userCount}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-semibold ${row.active ? 'text-emerald-600' : 'text-ink-faint'}`}>
                        {row.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setEditId(row.id)}
                          className="px-2 py-0.5 rounded text-sm border border-line hover:bg-slate-50">수정</button>
                        <button onClick={() => handleToggleActive(row)}
                          className={`px-2 py-0.5 rounded text-sm border ${row.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          {row.active ? '비활성화' : '활성화'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-faint text-sm">등록된 직급이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRankRow({ row, onSave, onCancel }: { row: RankRow; onSave: (d: Partial<RankRow>) => void; onCancel: () => void }) {
  const [name, setName] = useState(row.name);
  const [level, setLevel] = useState(row.level);
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  return (
    <>
      <td className="px-3 py-1"><input className="border border-line rounded px-2 py-0.5 text-sm w-full" value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td className="px-3 py-1"><input type="number" className="border border-line rounded px-1 py-0.5 text-sm w-16" value={level} onChange={(e) => setLevel(Number(e.target.value))} /></td>
      <td className="px-3 py-1"><input type="number" className="border border-line rounded px-1 py-0.5 text-sm w-16" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></td>
      <td className="px-3 py-1 text-center">{row.userCount}</td>
      <td className="px-3 py-1 text-center">{row.active ? '활성' : '비활성'}</td>
      <td className="px-3 py-1">
        <div className="flex gap-1 justify-center">
          <button onClick={() => onSave({ name, level, sortOrder })} className="px-2 py-0.5 rounded text-sm bg-primary text-white">저장</button>
          <button onClick={onCancel} className="px-2 py-0.5 rounded text-sm border border-line">취소</button>
        </div>
      </td>
    </>
  );
}
