'use client';

import { useEffect, useState, useCallback } from 'react';

type Worker = { id: string; name: string; employeeNo: string | null; status: string };
type Zone = { id: string; zoneName: string; zoneCode: string; dongs: Dong[] };
type Dong = { id: string; dongName: string; dongCode: string };

type Assignment = {
  id: string;
  userId: string;
  userName: string;
  employeeNo: string | null;
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  dongId: string | null;
  dongName: string | null;
  addressType: string | null;
  address: string | null;
  memo: string | null;
};

function groupByWorker(assignments: Assignment[]): Map<string, { worker: Pick<Assignment, 'userId' | 'userName' | 'employeeNo'>; items: Assignment[] }> {
  const map = new Map<string, { worker: Pick<Assignment, 'userId' | 'userName' | 'employeeNo'>; items: Assignment[] }>();
  for (const a of assignments) {
    if (!map.has(a.userId)) {
      map.set(a.userId, { worker: { userId: a.userId, userName: a.userName, employeeNo: a.employeeNo }, items: [] });
    }
    map.get(a.userId)!.items.push(a);
  }
  return map;
}

const ADDR_TYPE_LABEL: Record<string, string> = { road: '도로명', lot: '지번' };

export default function WorkerZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* 검색 */
  const [workerSearch, setWorkerSearch] = useState('');

  /* 배정 추가 폼 */
  const [showAdd, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addZoneId, setAddZoneId] = useState('');
  const [addDongId, setAddDongId] = useState('');
  const [addAddrType, setAddAddrType] = useState<'road' | 'lot' | ''>('');
  const [addAddress, setAddAddress] = useState('');
  const [addMemo, setAddMemo] = useState('');
  const [saving, setSaving] = useState(false);

  /* 수정 */
  const [editId, setEditId] = useState<string | null>(null);
  const [editAddrType, setEditAddrType] = useState<'road' | 'lot' | ''>('');
  const [editAddress, setEditAddress] = useState('');
  const [editMemo, setEditMemo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [zonesRes, workersRes, assignRes] = await Promise.all([
      fetch('/api/contractor/zones'),
      fetch('/api/users?role=WORKER&status=ACTIVE&take=200'),
      fetch('/api/contractor/worker-zones'),
    ]);
    const [zj, wj, aj] = await Promise.all([zonesRes.json(), workersRes.json(), assignRes.json()]);
    setZones(zj.zones ?? []);
    setWorkers(wj.users ?? []);
    setAssignments(aj.assignments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addDongs = zones.find((z) => z.id === addZoneId)?.dongs ?? [];

  async function addAssignment() {
    if (!addUserId || !addZoneId) return;
    setSaving(true);
    setError(null);
    const r = await fetch('/api/contractor/worker-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: addUserId,
        zoneId: addZoneId,
        dongId: addDongId || null,
        addressType: addAddrType || null,
        address: addAddress.trim() || null,
        memo: addMemo.trim() || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setShowAdd(false);
      setAddUserId(''); setAddZoneId(''); setAddDongId('');
      setAddAddrType(''); setAddAddress(''); setAddMemo('');
      load();
    } else {
      const j = await r.json().catch(() => ({}));
      if (j.error === 'duplicate_assignment') setError('이미 동일한 배정이 있습니다.');
      else setError('저장 실패');
    }
  }

  async function saveEdit(id: string) {
    setError(null);
    const r = await fetch(`/api/contractor/worker-zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addressType: editAddrType || null,
        address: editAddress.trim() || null,
        memo: editMemo.trim() || null,
      }),
    });
    if (r.ok) { setEditId(null); load(); }
    else setError('수정 실패');
  }

  async function removeAssignment(id: string, workerName: string) {
    if (!confirm(`${workerName}의 담당구역 배정을 삭제할까요?`)) return;
    setError(null);
    const r = await fetch(`/api/contractor/worker-zones/${id}`, { method: 'DELETE' });
    if (r.ok) load();
    else setError('삭제 실패');
  }

  const filteredMap = (() => {
    const grouped = groupByWorker(assignments);
    if (!workerSearch.trim()) return grouped;
    const q = workerSearch.trim();
    const result = new Map(
      [...grouped.entries()].filter(([, v]) =>
        v.worker.userName.includes(q) || (v.worker.employeeNo ?? '').includes(q)
      )
    );
    return result;
  })();

  /* 아직 배정 없는 작업자도 검색에 포함해 표시 */
  const unassignedWorkers = workerSearch.trim()
    ? workers.filter(
        (w) =>
          !assignments.find((a) => a.userId === w.id) &&
          (w.name.includes(workerSearch) || (w.employeeNo ?? '').includes(workerSearch))
      )
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">작업자 담당구역 배정</h2>
          <p className="text-sm text-ink-muted mt-1">
            작업자별 담당 구역·행정동을 지정하고, 도로명 또는 지번으로 세부 작업 위치를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(null); }}
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800"
        >
          + 배정 추가
        </button>
      </div>

      {/* 구역코드 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-1">
        <div className="font-extrabold">구역코드(Zone Code) 사용법</div>
        <div className="text-blue-700 leading-relaxed">
          구역코드는 각 담당구역의 고유 식별자입니다. 차량일지·민원·출근 기록 시 자동 연결되어 구역별 집계 및 보고서 생성에 사용됩니다.
          작업자에게 코드를 공지하거나, 지도 앱·GPS 태깅 시스템과 연동할 때 활용할 수 있습니다.
          예) <span className="font-mono bg-blue-100 px-1 rounded">GN-E-01</span> → 강남구 동부 1구역
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-bold">
          {error}
        </div>
      )}

      {/* 배정 추가 폼 */}
      {showAdd && (
        <div className="bg-surface border-2 border-accent rounded-xl p-5 space-y-4">
          <div className="text-sm font-extrabold text-ink">새 담당구역 배정</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-ink-muted block mb-1">작업자 *</label>
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              >
                <option value="">선택하세요</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.employeeNo ? ` (${w.employeeNo})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-ink-muted block mb-1">구역 *</label>
              <select
                value={addZoneId}
                onChange={(e) => { setAddZoneId(e.target.value); setAddDongId(''); }}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              >
                <option value="">선택하세요</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.zoneName} ({z.zoneCode})</option>
                ))}
              </select>
            </div>
            {addZoneId && addDongs.length > 0 && (
              <div>
                <label className="text-sm font-bold text-ink-muted block mb-1">행정동 (선택)</label>
                <select
                  value={addDongId}
                  onChange={(e) => setAddDongId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
                >
                  <option value="">구역 전체</option>
                  {addDongs.map((d) => (
                    <option key={d.id} value={d.id}>{d.dongName} ({d.dongCode})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-bold text-ink-muted block mb-1">주소 유형</label>
              <select
                value={addAddrType}
                onChange={(e) => setAddAddrType(e.target.value as 'road' | 'lot' | '')}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              >
                <option value="">없음</option>
                <option value="road">도로명주소</option>
                <option value="lot">지번주소</option>
              </select>
            </div>
            {addAddrType && (
              <div className="sm:col-span-2">
                <label className="text-sm font-bold text-ink-muted block mb-1">
                  {addAddrType === 'road' ? '도로명주소' : '지번주소'}
                </label>
                <input
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder={addAddrType === 'road' ? '예: 강남대로 123번길 45' : '예: 논현동 100-1'}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-sm font-bold text-ink-muted block mb-1">메모</label>
              <input
                value={addMemo}
                onChange={(e) => setAddMemo(e.target.value)}
                placeholder="예: 오전 담당, 격주 순환 등"
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAdd(false); setError(null); }}
              className="px-4 py-2 rounded-lg bg-slate-200 text-ink text-sm font-bold"
            >
              취소
            </button>
            <button
              disabled={!addUserId || !addZoneId || saving}
              onClick={addAssignment}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50"
            >
              {saving ? '저장 중…' : '배정'}
            </button>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div>
        <input
          value={workerSearch}
          onChange={(e) => setWorkerSearch(e.target.value)}
          placeholder="작업자 이름 또는 사번으로 검색"
          className="w-full px-4 py-2.5 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {loading && <div className="py-12 text-center text-sm text-ink-muted">로딩 중…</div>}

      {!loading && filteredMap.size === 0 && unassignedWorkers.length === 0 && (
        <div className="py-16 text-center text-sm text-ink-muted font-bold border-2 border-dashed border-line rounded-xl">
          {workerSearch ? '검색 결과가 없습니다.' : '배정된 담당구역이 없습니다.'}
        </div>
      )}

      {/* 배정 목록 (작업자별 그룹) */}
      {[...filteredMap.values()].map(({ worker, items }) => (
        <div key={worker.userId} className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-surface-soft border-b border-line">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-extrabold text-sm flex-shrink-0">
              {worker.userName.charAt(0)}
            </div>
            <div className="flex-1">
              <span className="text-sm font-extrabold text-ink">{worker.userName}</span>
              {worker.employeeNo && (
                <span className="text-xs text-ink-muted ml-2">({worker.employeeNo})</span>
              )}
            </div>
            <span className="text-xs text-ink-muted">{items.length}개 구역</span>
          </div>
          <div className="divide-y divide-line">
            {items.map((a) => (
              <div key={a.id} className="px-5 py-3">
                {editId === a.id ? (
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-ink">{a.zoneName} ({a.zoneCode}){a.dongName ? ` › ${a.dongName}` : ''}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={editAddrType}
                        onChange={(e) => setEditAddrType(e.target.value as 'road' | 'lot' | '')}
                        className="px-2.5 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                      >
                        <option value="">주소 없음</option>
                        <option value="road">도로명주소</option>
                        <option value="lot">지번주소</option>
                      </select>
                      {editAddrType && (
                        <input
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          placeholder="주소 입력"
                          maxLength={200}
                          className="px-2.5 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                        />
                      )}
                      <input
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        placeholder="메모"
                        maxLength={200}
                        className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded bg-slate-200 text-ink text-sm font-bold">취소</button>
                      <button onClick={() => saveEdit(a.id)} className="px-3 py-1.5 rounded bg-accent text-white text-sm font-extrabold">저장</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink">
                        {a.zoneName}
                        <span className="font-mono text-ink-muted ml-1.5 text-xs">({a.zoneCode})</span>
                        {a.dongName && (
                          <span className="text-ink-muted ml-1.5">› {a.dongName}</span>
                        )}
                      </div>
                      {a.address && (
                        <div className="text-xs text-ink-muted mt-0.5">
                          <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded font-bold mr-1">
                            {ADDR_TYPE_LABEL[a.addressType ?? ''] ?? a.addressType}
                          </span>
                          {a.address}
                        </div>
                      )}
                      {a.memo && <div className="text-xs text-ink-faint mt-0.5">{a.memo}</div>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditId(a.id);
                          setEditAddrType((a.addressType as 'road' | 'lot' | '') ?? '');
                          setEditAddress(a.address ?? '');
                          setEditMemo(a.memo ?? '');
                          setError(null);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 text-ink-muted text-xs font-bold hover:bg-slate-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => removeAssignment(a.id, a.userName)}
                        className="px-2.5 py-1 rounded bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 검색 시 배정 없는 작업자도 표시 */}
      {unassignedWorkers.map((w) => (
        <div key={w.id} className="bg-surface border border-dashed border-line rounded-xl px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-ink-muted font-extrabold text-sm flex-shrink-0">
            {w.name.charAt(0)}
          </div>
          <div className="flex-1">
            <span className="text-sm font-extrabold text-ink">{w.name}</span>
            {w.employeeNo && <span className="text-xs text-ink-muted ml-2">({w.employeeNo})</span>}
          </div>
          <span className="text-xs text-ink-faint">배정 없음</span>
        </div>
      ))}
    </div>
  );
}
