'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type RestrictionRow = {
  id: string;
  departmentId: string | null;
  departmentName: string | null;
  name: string;
  checkInFrom: string | null;
  checkInUntil: string | null;
  checkOutFrom: string | null;
  checkOutUntil: string | null;
  requireLocation: boolean;
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
  locationLabel: string | null;
  allowedDays: number[] | null;
  active: boolean;
  sortOrder: number;
};

export type DeptOpt = { id: string; name: string };

export default function PunchRestrictionsClient({
  rows,
  departments,
}: {
  rows: RestrictionRow[];
  departments: DeptOpt[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<RestrictionRow | 'NEW' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localRows, setLocalRows] = useState<RestrictionRow[]>(() =>
    [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  async function moveRow(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= localRows.length) return;
    const next = [...localRows];
    [next[idx], next[target]] = [next[target], next[idx]];
    // assign new sortOrder values (0-based index)
    const updated = next.map((r, i) => ({ ...r, sortOrder: i }));
    setLocalRows(updated);
    setBusy(true);
    try {
      await Promise.all([
        fetch(`/api/punch-restrictions/${updated[idx].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: updated[idx].sortOrder }),
        }),
        fetch(`/api/punch-restrictions/${updated[target].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: updated[target].sortOrder }),
        }),
      ]);
    } catch { setError('순번 변경 실패'); }
    finally { setBusy(false); }
  }

  async function toggleActive(r: RestrictionRow) {
    setBusy(true);
    const res = await fetch(`/api/punch-restrictions/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError('변경 실패');
  }

  async function del(r: RestrictionRow) {
    if (!confirm(`'${r.name}' 규칙을 삭제하시겠습니까?`)) return;
    setBusy(true);
    const res = await fetch(`/api/punch-restrictions/${r.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError('삭제 실패');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink">출퇴근 제한 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">부서별 지정 시간대·장소 기반 출퇴근 허용 규칙</p>
        </div>
        <button
          onClick={() => setEditing('NEW')}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 shadow-card"
        >
          + 규칙 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      {localRows.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center text-sm font-bold text-ink-muted">
          등록된 출퇴근 제한 규칙이 없습니다.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface-soft text-[0.6875rem] font-mono font-extrabold text-ink uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left w-16">순번</th>
                <th className="px-4 py-2.5 text-left">규칙명</th>
                <th className="px-4 py-2.5 text-left">대상 부서</th>
                <th className="px-4 py-2.5 text-left">출근 허용</th>
                <th className="px-4 py-2.5 text-left">퇴근 허용</th>
                <th className="px-4 py-2.5 text-left">위치 제한</th>
                <th className="px-4 py-2.5 text-left">적용 요일</th>
                <th className="px-4 py-2.5 text-left">상태</th>
                <th className="px-4 py-2.5 text-left">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {localRows.map((r, idx) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5 items-center">
                      <button
                        onClick={() => moveRow(idx, -1)}
                        disabled={busy || idx === 0}
                        className="text-[0.6rem] font-extrabold text-ink-muted hover:text-accent disabled:opacity-30 leading-none px-1"
                        title="위로"
                      >▲</button>
                      <span className="text-[0.6875rem] font-mono font-bold text-ink-muted">{idx + 1}</span>
                      <button
                        onClick={() => moveRow(idx, 1)}
                        disabled={busy || idx === localRows.length - 1}
                        className="text-[0.6rem] font-extrabold text-ink-muted hover:text-accent disabled:opacity-30 leading-none px-1"
                        title="아래로"
                      >▼</button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-ink">{r.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted font-bold">{r.departmentName ?? '전체'}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-ink">
                    {r.checkInFrom || r.checkInUntil
                      ? `${r.checkInFrom ?? '--:--'} ~ ${r.checkInUntil ?? '--:--'}`
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-ink">
                    {r.checkOutFrom || r.checkOutUntil
                      ? `${r.checkOutFrom ?? '--:--'} ~ ${r.checkOutUntil ?? '--:--'}`
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.requireLocation && r.lat != null
                      ? <span className="text-xs font-bold text-accent">{r.locationLabel ?? '지정 좌표'} ({r.radiusMeters}m)</span>
                      : <span className="text-ink-faint text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-xs text-ink">
                    {r.allowedDays && r.allowedDays.length > 0
                      ? r.allowedDays.map((d) => ['월','화','수','목','금','토','일'][d]).join('')
                      : <span className="text-ink-faint">매일</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[0.6875rem] font-extrabold px-2 py-0.5 rounded border ${r.active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                      {r.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing(r)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded text-xs font-extrabold border border-accent text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => toggleActive(r)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded text-xs font-extrabold border border-slate-400 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {r.active ? '비활성화' : '활성화'}
                      </button>
                      <button
                        onClick={() => del(r)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded text-xs font-extrabold border border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RestrictionFormModal
          initial={editing === 'NEW' ? null : editing}
          departments={departments}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
            // Reset local order after save to stay in sync
            setLocalRows((prev) => [...prev]);
          }}
        />
      )}
    </div>
  );
}

function RestrictionFormModal({
  initial,
  departments,
  onCancel,
  onSaved,
}: {
  initial: RestrictionRow | null;
  departments: DeptOpt[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [deptId, setDeptId] = useState(initial?.departmentId ?? '');
  const [checkInFrom, setCheckInFrom] = useState(initial?.checkInFrom ?? '');
  const [checkInUntil, setCheckInUntil] = useState(initial?.checkInUntil ?? '');
  const [checkOutFrom, setCheckOutFrom] = useState(initial?.checkOutFrom ?? '');
  const [checkOutUntil, setCheckOutUntil] = useState(initial?.checkOutUntil ?? '');
  const [requireLocation, setRequireLocation] = useState(initial?.requireLocation ?? false);
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : '');
  const [lng, setLng] = useState(initial?.lng != null ? String(initial.lng) : '');
  const [radius, setRadius] = useState(initial?.radiusMeters != null ? String(initial.radiusMeters) : '200');
  const [locationLabel, setLocationLabel] = useState(initial?.locationLabel ?? '');
  const [allowedDays, setAllowedDays] = useState<number[]>(initial?.allowedDays ?? []);
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError('규칙명을 입력하세요.'); return; }
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      departmentId: deptId || null,
      checkInFrom: checkInFrom || null,
      checkInUntil: checkInUntil || null,
      checkOutFrom: checkOutFrom || null,
      checkOutUntil: checkOutUntil || null,
      requireLocation,
      lat: requireLocation && lat ? Number(lat) : null,
      lng: requireLocation && lng ? Number(lng) : null,
      radiusMeters: requireLocation && radius ? Number(radius) : null,
      locationLabel: requireLocation && locationLabel ? locationLabel : null,
      allowedDays: allowedDays.length > 0 ? allowedDays : null,
      active,
    };
    const res = await fetch(
      isEdit ? `/api/punch-restrictions/${initial!.id}` : '/api/punch-restrictions',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    setBusy(false);
    if (res.ok) onSaved();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? d?.error ?? '저장 실패');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-modal max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
          <h3 className="text-base font-extrabold text-ink flex-1">{isEdit ? '출퇴근 제한 수정' : '출퇴근 제한 추가'}</h3>
          <button onClick={onCancel} className="text-2xl font-bold text-ink-muted">&times;</button>
        </header>
        <div className="p-5 space-y-4">
          <Field label="규칙명 *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 차고지 근무조 시간 제한"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus:border-accent" />
          </Field>
          <Field label="대상 부서 (비워두면 전체 적용)">
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
              <option value="">— 전체 (부서 무관) —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="출근 허용 시작">
              <input type="time" value={checkInFrom} onChange={(e) => setCheckInFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="출근 허용 종료">
              <input type="time" value={checkInUntil} onChange={(e) => setCheckInUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="퇴근 허용 시작">
              <input type="time" value={checkOutFrom} onChange={(e) => setCheckOutFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="퇴근 허용 종료">
              <input type="time" value={checkOutUntil} onChange={(e) => setCheckOutUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
          </div>

          <div className="space-y-2">
            <span className="block text-[0.6875rem] font-extrabold text-ink tracking-wide">적용 요일 (비워두면 매일 적용)</span>
            <div className="flex gap-1.5 flex-wrap">
              {([['월','0'],['화','1'],['수','2'],['목','3'],['금','4'],['토','5'],['일','6']] as [string,string][]).map(([label, val]) => {
                const dayNum = Number(val);
                const checked = allowedDays.includes(dayNum);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAllowedDays(checked ? allowedDays.filter((d) => d !== dayNum) : [...allowedDays, dayNum].sort((a, b) => a - b))}
                    className={`w-9 h-9 rounded-full text-xs font-extrabold border-2 transition-colors ${checked ? 'bg-accent text-white border-accent' : 'bg-surface text-ink-muted border-line hover:border-accent'} ${(dayNum === 5 || dayNum === 6) ? 'text-red-500' : ''}`}
                  >
                    {label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setAllowedDays([])} className="px-2 py-1 text-[0.625rem] font-bold text-ink-muted border border-line rounded hover:bg-slate-50">초기화</button>
            </div>
            {allowedDays.length > 0 && (
              <p className="text-[0.625rem] font-mono text-ink-muted">선택된 요일만 적용됩니다</p>
            )}
          </div>

          <div className="border border-line rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-line accent-accent" />
              <span className="text-sm font-extrabold text-ink">지정 장소 제한 사용</span>
              <span className="text-xs font-bold text-slate-500 ml-1">(출근·퇴근 모두 적용)</span>
            </label>
            {requireLocation && (
              <>
                <Field label="장소 이름 (안내용)">
                  <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="예: 차고지 정문"
                    className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus:border-accent" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="위도">
                    <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="37.4979"
                      className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
                  </Field>
                  <Field label="경도">
                    <input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="127.0276"
                      className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
                  </Field>
                  <Field label="허용 반경(m)">
                    <input type="number" min={10} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="200"
                      className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
                  </Field>
                </div>
                <p className="text-xs font-mono text-ink-muted">지정 좌표를 모르면 Google Maps에서 우클릭 → 좌표 복사</p>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-line accent-accent" />
            <span className="text-sm font-extrabold text-ink">규칙 활성화</span>
          </label>

          {error && <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-800">{error}</div>}
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold">취소</button>
          <button onClick={save} disabled={busy || !name.trim()}
            className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[0.6875rem] font-extrabold text-ink mb-1.5 tracking-wide">{label}</span>
      {children}
    </label>
  );
}
