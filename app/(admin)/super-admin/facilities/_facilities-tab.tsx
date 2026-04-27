'use client';

// Design Ref: §3.1.1 — 처리시설 마스터 관리 탭 (지자체 단위)
// 같은 지자체 산하 위탁업체는 자동으로 동일 facility 목록 사용

import { useEffect, useMemo, useState } from 'react';
import { FACILITY_TYPES, FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/facility';

type Facility = {
  id: string;
  municipalityId: string;
  municipalityName: string;
  municipalityRegion: string | null;
  type: FacilityType;
  name: string;
  address: string | null;
  active: boolean;
  updatedAt: string;
};

type Muni = { id: string; name: string; region: string | null };

export function FacilitiesTab() {
  const [items, setItems] = useState<Facility[]>([]);
  const [munis, setMunis] = useState<Muni[]>([]);
  const [selectedMuniId, setSelectedMuniId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  /* 지자체 목록 로드 (SUPER_ADMIN — 전체 / MUNI_ADMIN — 자기 지자체만) */
  useEffect(() => {
    fetch('/api/super-admin/municipalities?limit=500&status=ACTIVE')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const opts = (j.items ?? []).map((m: { id: string; name: string; region: string | null }) => ({
          id: m.id,
          name: m.name,
          region: m.region,
        }));
        setMunis(opts);
        if (opts.length > 0 && !selectedMuniId) setSelectedMuniId(opts[0].id);
      })
      .catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  function load() {
    if (!selectedMuniId) { setItems([]); return; }
    setLoading(true);
    fetch(`/api/super-admin/facilities?municipalityId=${selectedMuniId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedMuniId]);

  async function toggleActive(f: Facility) {
    if (!confirm(f.active ? `'${f.name}'을(를) 비활성화하시겠습니까?` : `'${f.name}'을(를) 다시 활성화하시겠습니까?`)) return;
    const res = await fetch(`/api/super-admin/facilities/${f.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !f.active }),
    });
    if (res.ok) load();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  async function remove(f: Facility) {
    if (!confirm(`'${f.name}'을(를) 영구 삭제합니다.\n반입실적이 있으면 삭제 불가 (409). 계속하시겠습니까?`)) return;
    const res = await fetch(`/api/super-admin/facilities/${f.id}`, { method: 'DELETE' });
    if (res.ok) { alert('삭제 완료'); load(); return; }
    const j = await res.json().catch(() => ({}));
    if (res.status === 409) alert(`삭제 차단:\n${j.detail ?? '연결된 데이터가 있습니다'}`);
    else alert(`실패: ${j.error ?? `HTTP ${res.status}`}`);
  }

  const selectedMuni = useMemo(() => munis.find((m) => m.id === selectedMuniId), [munis, selectedMuniId]);

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <span className="font-extrabold text-ink">처리시설 마스터</span>
        <span className="text-[11px] font-mono text-slate-700 font-bold">지자체 단위 — 산하 위탁업체 자동 반영</span>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="facility-muni-picker" className="text-xs font-extrabold text-slate-700">지자체</label>
          <select
            id="facility-muni-picker"
            value={selectedMuniId}
            onChange={(e) => setSelectedMuniId(e.target.value)}
            className="px-3 py-1.5 rounded-md border-2 border-line text-sm font-bold bg-surface min-h-[36px]"
          >
            {munis.length === 0 && <option value="">— 지자체 없음 —</option>}
            {munis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.region ? `[${m.region}] ` : ''}{m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!selectedMuniId}
            className="px-4 py-1.5 rounded text-xs font-extrabold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
            + 처리시설 등록
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {loading && <div className="text-center py-10 text-slate-700 font-bold">로딩 중…</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-10 text-slate-700 font-bold">
            {selectedMuni ? `${selectedMuni.name}에 등록된 처리시설이 없습니다.` : '지자체를 선택해 주세요.'}
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-100 text-[11px] font-mono font-extrabold text-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">분류</th>
                  <th className="px-3 py-2 text-left">시설명</th>
                  <th className="px-3 py-2 text-left">주소</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((f) => (
                  <tr key={f.id} className={`hover:bg-slate-50 ${f.active ? '' : 'opacity-50'}`}>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                        {FACILITY_TYPE_LABELS[f.type] ?? f.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold">{f.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-700 max-w-[280px] truncate" title={f.address ?? ''}>{f.address ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                        f.active ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-slate-200 text-slate-700 border-slate-400'
                      }`}>
                        {f.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(f)} className="text-xs font-bold text-accent hover:underline mr-2">수정</button>
                      <button onClick={() => toggleActive(f)} className="text-xs font-bold text-amber-700 hover:underline mr-2">
                        {f.active ? '비활성화' : '활성화'}
                      </button>
                      <button onClick={() => remove(f)} className="text-xs font-bold text-danger hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && selectedMuniId && (
        <FacilityFormModal
          municipalityId={selectedMuniId}
          municipalityName={selectedMuni?.name ?? ''}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editing && (
        <FacilityFormModal
          initial={editing}
          municipalityId={editing.municipalityId}
          municipalityName={editing.municipalityName}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function FacilityFormModal({ initial, municipalityId, municipalityName, onClose, onSaved }: {
  initial?: Facility;
  municipalityId: string;
  municipalityName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    type: initial?.type ?? ('RECYCLING_CENTER' as FacilityType),
    name: initial?.name ?? '',
    address: initial?.address ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const url = initial ? `/api/super-admin/facilities/${initial.id}` : '/api/super-admin/facilities';
    const method = initial ? 'PATCH' : 'POST';
    const body: Record<string, unknown> = {
      type: form.type,
      name: form.name.trim(),
      address: form.address.trim() || null,
    };
    if (!initial) body.municipalityId = municipalityId;
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) onSaved();
    else {
      const e = await res.json().catch(() => ({}));
      const errorMap: Record<string, string> = {
        duplicate_facility: '이미 동일한 분류·이름의 시설이 등록되어 있습니다.',
        municipality_required: 'SUPER_ADMIN 은 지자체 선택이 필요합니다.',
        forbidden: '권한이 없습니다. (SUPER_ADMIN 또는 MUNI_ADMIN 만 등록 가능)',
        no_scope: '지자체가 지정되지 않았습니다.',
        invalid_request: '입력값이 올바르지 않습니다.',
      };
      const baseMsg = errorMap[e.error] ?? e.error ?? `저장 실패 (HTTP ${res.status})`;
      const fieldDetail = e.fieldErrors ? ' · ' + Object.entries(e.fieldErrors).map(([k, v]) => `${k}: ${(v as string[])?.join(',')}`).join(' / ') : '';
      setError(baseMsg + fieldDetail);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line bg-purple-50">
          <h3 className="font-extrabold text-ink">{initial ? '처리시설 수정' : '처리시설 신규 등록'}</h3>
          <div className="text-[11px] font-mono font-bold text-slate-700 mt-0.5">{municipalityName}</div>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label htmlFor="fac-type" className="block text-[11px] font-mono font-extrabold text-slate-700 mb-1">분류</label>
            <select
              id="fac-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as FacilityType })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold">
              {FACILITY_TYPES.map((t) => <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fac-name" className="block text-[11px] font-mono font-extrabold text-slate-700 mb-1">시설명 *</label>
            <input
              id="fac-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: ○○구 자원순환센터"
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold" />
          </div>
          <div>
            <label htmlFor="fac-address" className="block text-[11px] font-mono font-extrabold text-slate-700 mb-1">주소</label>
            <input
              id="fac-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="(선택)"
              className="w-full px-3 py-1.5 rounded border border-line text-sm" />
          </div>
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-xs font-bold text-red-700">{error}</div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
          <button
            disabled={saving || !form.name.trim()}
            onClick={submit}
            className="px-5 py-1.5 rounded text-sm font-extrabold bg-purple-600 text-white disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
