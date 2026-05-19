'use client';

import { useEffect, useState, useCallback } from 'react';

type DongLookup = { dongCode: string | null; dongName: string; population: number | null; areaKm2: number | null };
type Dong = { id: string; dongName: string; dongCode: string; population: number | null; householdCount: number | null; areaKm2: number | null };
type Zone = { id: string; zoneName: string; zoneCode: string; areaKm2: number | null; dongs: Dong[] };

function empty<T>(arr: T[]): arr is [] { return arr.length === 0; }

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* cost API 행정동 목록 */
  const [lookupDongs, setLookupDongs] = useState<DongLookup[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  /* 구역 추가 폼 */
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newAreaKm2, setNewAreaKm2] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  /* 구역 수정 */
  const [editZoneId, setEditZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneCode, setEditZoneCode] = useState('');
  const [editAreaKm2, setEditAreaKm2] = useState('');

  /* 행정동 추가 */
  const [addDongZoneId, setAddDongZoneId] = useState<string | null>(null);
  const [dongSearch, setDongSearch] = useState('');
  const [selectedDong, setSelectedDong] = useState<DongLookup | null>(null);
  const [newDongName, setNewDongName] = useState('');
  const [newDongCode, setNewDongCode] = useState('');
  const [savingDong, setSavingDong] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/contractor/zones');
    const j = await r.json();
    setZones(j.zones ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* cost API 행정동 목록 1회 로드 */
  useEffect(() => {
    fetch('/api/lookup/dongs')
      .then((r) => r.json())
      .then((j) => {
        if (j.dongs) setLookupDongs(j.dongs);
        else setLookupError('행정동 데이터를 불러올 수 없습니다.');
      })
      .catch(() => setLookupError('행정동 데이터 서버에 연결할 수 없습니다.'));
  }, []);

  /* 검색 필터 */
  const filteredDongs = lookupDongs.filter((d) =>
    d.dongName.includes(dongSearch) || (d.dongCode ?? '').includes(dongSearch)
  );

  async function addZone() {
    if (!newZoneName.trim() || !newZoneCode.trim()) return;
    setSavingZone(true);
    setError(null);
    const r = await fetch('/api/contractor/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneName: newZoneName.trim(),
        zoneCode: newZoneCode.trim(),
        areaKm2: newAreaKm2 ? parseFloat(newAreaKm2) : null,
      }),
    });
    setSavingZone(false);
    if (r.ok) {
      setNewZoneName(''); setNewZoneCode(''); setNewAreaKm2('');
      setShowAddZone(false);
      load();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error === 'zone_code_duplicate' ? '구역코드가 이미 사용 중입니다.' : '추가 실패');
    }
  }

  async function saveEditZone(id: string) {
    setError(null);
    const r = await fetch(`/api/contractor/zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneName: editZoneName.trim(),
        zoneCode: editZoneCode.trim(),
        areaKm2: editAreaKm2 ? parseFloat(editAreaKm2) : null,
      }),
    });
    if (r.ok) { setEditZoneId(null); load(); }
    else {
      const j = await r.json().catch(() => ({}));
      setError(j.error === 'zone_code_duplicate' ? '구역코드가 이미 사용 중입니다.' : '수정 실패');
    }
  }

  async function deleteZone(id: string) {
    if (!confirm('구역을 삭제하면 연결된 행정동도 모두 제거됩니다. 계속할까요?')) return;
    setError(null);
    const r = await fetch(`/api/contractor/zones/${id}`, { method: 'DELETE' });
    if (r.ok) { load(); }
    else {
      const j = await r.json().catch(() => ({}));
      if (j.error === 'zone_in_use') {
        setError(`연결된 민원(${j.complaintCount}건) 또는 차량일지(${j.vehicleLogCount}건)가 있어 삭제할 수 없습니다.`);
      } else {
        setError('삭제 실패');
      }
    }
  }

  function selectDong(d: DongLookup) {
    setSelectedDong(d);
    setNewDongName(d.dongName);
    setNewDongCode(d.dongCode ?? '');
    setDongSearch('');
  }

  function clearDongSelection() {
    setSelectedDong(null);
    setNewDongName('');
    setNewDongCode('');
    setDongSearch('');
  }

  async function addDong(zoneId: string) {
    if (!newDongName.trim() || !newDongCode.trim()) return;
    setSavingDong(true);
    setError(null);
    const r = await fetch(`/api/contractor/zones/${zoneId}/dongs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dongName: newDongName.trim(),
        dongCode: newDongCode.trim(),
        population: selectedDong?.population ?? null,
        areaKm2: selectedDong?.areaKm2 ?? null,
      }),
    });
    setSavingDong(false);
    if (r.ok) {
      clearDongSelection();
      setAddDongZoneId(null);
      load();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error === 'dong_code_duplicate' ? '이미 등록된 행정동 코드입니다.' : '추가 실패');
    }
  }

  async function deleteDong(zoneId: string, dongId: string) {
    if (!confirm('행정동을 제거할까요?')) return;
    setError(null);
    const r = await fetch(`/api/contractor/zones/${zoneId}/dongs/${dongId}`, { method: 'DELETE' });
    if (r.ok) load();
    else setError('삭제 실패');
  }

  const haslookup = lookupDongs.length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">담당구역 관리</h2>
          <p className="text-sm text-ink-muted mt-1">
            위탁업체의 수거구역과 담당 행정동을 등록합니다. 민원·차량일지·지자체 집계에 사용됩니다.
          </p>
        </div>
        <button
          onClick={() => { setShowAddZone(true); setError(null); }}
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-cyan-800"
        >
          + 구역 추가
        </button>
      </div>

      {lookupError && (
        <div className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-bold">
          ⚠ {lookupError} — 행정동 수동 입력으로 진행할 수 있습니다.
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-bold">
          {error}
        </div>
      )}

      {/* 구역 추가 폼 */}
      {showAddZone && (
        <div className="bg-surface border-2 border-accent rounded-xl p-5 space-y-4">
          <div className="text-sm font-extrabold text-ink">새 담당구역 추가</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink-muted block mb-1">구역명 *</label>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="예: 1구역"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-muted block mb-1">구역코드 *</label>
              <input
                value={newZoneCode}
                onChange={(e) => setNewZoneCode(e.target.value)}
                placeholder="예: Z01"
                maxLength={20}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-ink-muted block mb-1">구역 면적 (km²)</label>
              <input
                type="number"
                value={newAreaKm2}
                onChange={(e) => setNewAreaKm2(e.target.value)}
                placeholder="행정동 추가 후 자동 합산"
                min={0}
                step={0.0001}
                className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-[0.625rem] text-ink-muted mt-0.5">비워두면 소속 행정동 면적 합산으로 표시됩니다.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAddZone(false); setError(null); }}
              className="px-4 py-2 rounded-lg bg-slate-200 text-ink text-sm font-bold"
            >
              취소
            </button>
            <button
              disabled={!newZoneName.trim() || !newZoneCode.trim() || savingZone}
              onClick={addZone}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {loading && <div className="py-12 text-center text-sm text-ink-muted">로딩 중…</div>}

      {!loading && empty(zones) && (
        <div className="py-16 text-center text-sm text-ink-muted font-bold border-2 border-dashed border-line rounded-xl">
          등록된 담당구역이 없습니다.<br />
          <span className="text-xs">[구역 추가] 버튼으로 첫 번째 구역을 등록하세요.</span>
        </div>
      )}

      {zones.map((zone) => {
        /* 면적: 직접 입력값 없으면 행정동 합산 */
        const dongAreaSum = zone.dongs.reduce((s, d) => s + (d.areaKm2 ? Number(d.areaKm2) : 0), 0);
        const displayArea = zone.areaKm2 != null
          ? Number(zone.areaKm2).toFixed(4)
          : dongAreaSum > 0 ? dongAreaSum.toFixed(4) : null;

        return (
          <div key={zone.id} className="bg-surface border border-line rounded-xl overflow-hidden">
            {/* 구역 헤더 */}
            {editZoneId === zone.id ? (
              <div className="p-4 bg-surface-soft border-b border-line space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-ink-muted block mb-1">구역명</label>
                    <input
                      autoFocus
                      value={editZoneName}
                      onChange={(e) => setEditZoneName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-ink-muted block mb-1">구역코드</label>
                    <input
                      value={editZoneCode}
                      onChange={(e) => setEditZoneCode(e.target.value)}
                      maxLength={20}
                      className="w-full px-3 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-ink-muted block mb-1">면적 (km²)</label>
                    <input
                      type="number"
                      value={editAreaKm2}
                      onChange={(e) => setEditAreaKm2(e.target.value)}
                      min={0}
                      step={0.0001}
                      className="w-full px-3 py-1.5 rounded-lg border-2 border-accent text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditZoneId(null)} className="px-3 py-1.5 rounded bg-slate-200 text-ink text-xs font-bold">취소</button>
                  <button onClick={() => saveEditZone(zone.id)} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-extrabold">저장</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-4 bg-surface-soft border-b border-line">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-ink">{zone.zoneName}</span>
                    <span className="font-mono text-xs text-ink-muted">({zone.zoneCode})</span>
                    {displayArea && (
                      <span className="text-xs text-ink-muted">
                        {displayArea} km²{zone.areaKm2 == null && dongAreaSum > 0 ? ' (합산)' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">행정동 {zone.dongs.length}개</div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditZoneId(zone.id);
                      setEditZoneName(zone.zoneName);
                      setEditZoneCode(zone.zoneCode);
                      setEditAreaKm2(zone.areaKm2 != null ? String(zone.areaKm2) : '');
                      setError(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}

            {/* 행정동 목록 */}
            <div className="divide-y divide-line">
              {zone.dongs.map((dong) => (
                <div key={dong.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-ink">{dong.dongName}</span>
                    <span className="text-xs text-ink-muted ml-2 font-mono">{dong.dongCode}</span>
                    <span className="text-xs text-ink-muted ml-2">
                      {dong.population != null ? `인구 ${dong.population.toLocaleString()}명` : ''}
                      {dong.areaKm2 != null ? ` · ${Number(dong.areaKm2).toFixed(4)} km²` : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteDong(zone.id, dong.id)}
                    className="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 flex-shrink-0"
                  >
                    제거
                  </button>
                </div>
              ))}

              {/* 행정동 추가 폼 */}
              {addDongZoneId === zone.id ? (
                <div className="px-5 py-4 bg-blue-50 border-t border-blue-200 space-y-3">
                  {haslookup ? (
                    <>
                      {selectedDong ? (
                        /* 선택된 행정동 확인 카드 */
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border-2 border-accent">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-extrabold text-ink">{selectedDong.dongName}</div>
                              <div className="text-xs text-ink-muted mt-0.5">
                                {selectedDong.population != null ? `인구 ${selectedDong.population.toLocaleString()}명` : ''}
                                {selectedDong.areaKm2 != null ? ` · ${selectedDong.areaKm2.toFixed(4)} km²` : ''}
                              </div>
                            </div>
                            <button
                              onClick={clearDongSelection}
                              className="text-xs text-slate-500 hover:text-red-600 font-bold flex-shrink-0"
                            >
                              변경
                            </button>
                          </div>
                          {/* dong_code 없으면 수동 입력 */}
                          {!selectedDong.dongCode && (
                            <div>
                              <label className="text-xs font-bold text-amber-700 block mb-1">
                                ⚠ 행정동코드 직접 입력 *
                                <span className="font-normal text-ink-muted ml-1">(행안부 10자리 코드 — 예: 1171010100)</span>
                              </label>
                              <input
                                autoFocus
                                value={newDongCode}
                                onChange={(e) => setNewDongCode(e.target.value)}
                                placeholder="1171010100"
                                maxLength={20}
                                className="w-full px-3 py-1.5 rounded-lg border-2 border-amber-300 text-sm focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        /* 행정동 검색 드롭다운 */
                        <div>
                          <label className="text-xs font-bold text-ink-muted block mb-1">행정동 검색 *</label>
                          <input
                            autoFocus
                            value={dongSearch}
                            onChange={(e) => setDongSearch(e.target.value)}
                            placeholder="동 이름 또는 코드 입력"
                            className="w-full px-3 py-2 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent bg-white"
                          />
                          {dongSearch.length > 0 && (
                            <div className="mt-1 bg-white border border-line rounded-lg shadow-md max-h-48 overflow-y-auto">
                              {filteredDongs.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-ink-muted">검색 결과 없음</div>
                              ) : (
                                filteredDongs.slice(0, 20).map((d) => (
                                  <button
                                    key={d.dongCode}
                                    onClick={() => selectDong(d)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                                  >
                                    <span className="font-bold text-ink">{d.dongName}</span>
                                    <span className="text-xs text-ink-muted ml-2 font-mono">{d.dongCode}</span>
                                    {d.population != null && (
                                      <span className="text-xs text-ink-muted ml-1">인구 {d.population.toLocaleString()}명</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* fallback: 수동 입력 */
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-ink-muted block mb-1">행정동명 *</label>
                        <input
                          autoFocus
                          value={newDongName}
                          onChange={(e) => setNewDongName(e.target.value)}
                          placeholder="예: 중앙동"
                          maxLength={50}
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-ink-muted block mb-1">행정동코드 *</label>
                        <input
                          value={newDongCode}
                          onChange={(e) => setNewDongCode(e.target.value)}
                          placeholder="예: 4511310100"
                          maxLength={20}
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-line text-sm focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => { setAddDongZoneId(null); clearDongSelection(); setError(null); }}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 text-ink text-xs font-bold"
                    >
                      취소
                    </button>
                    <button
                      disabled={!newDongName.trim() || !newDongCode.trim() || savingDong}
                      onClick={() => addDong(zone.id)}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-extrabold disabled:opacity-50"
                    >
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-2.5">
                  <button
                    onClick={() => { setAddDongZoneId(zone.id); clearDongSelection(); setError(null); }}
                    className="text-xs font-bold text-accent hover:text-cyan-800"
                  >
                    + 행정동 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
