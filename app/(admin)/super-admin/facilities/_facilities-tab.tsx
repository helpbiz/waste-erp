'use client';

// Design Ref: §5.1.1 — 처리시설 마스터 관리 탭
// Plan SC: 처리시설 마스터 등록 가능 (4종 type)

import { useEffect, useState } from 'react';
import { FACILITY_TYPES, FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/facility';

type Facility = {
  id: string;
  contractorId: string;
  contractorName: string;
  type: FacilityType;
  name: string;
  address: string | null;
  active: boolean;
  updatedAt: string;
};

export function FacilitiesTab() {
  const [items, setItems] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/super-admin/facilities')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

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

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
        <span className="font-extrabold text-ink">처리시설 마스터</span>
        <span className="text-[11px] font-mono text-slate-600">최종 처리시설(소각장·위탁처리장·매립시설·자원순환센터) 등록</span>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto px-4 py-1.5 rounded text-xs font-extrabold bg-purple-600 text-white hover:bg-purple-700">
          + 처리시설 등록
        </button>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {loading && <div className="text-center py-10 text-slate-400">로딩 중…</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-10 text-slate-400">등록된 처리시설이 없습니다.</div>
        )}
        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-100 text-[11px] font-mono font-extrabold text-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">분류</th>
                  <th className="px-3 py-2 text-left">시설명</th>
                  <th className="px-3 py-2 text-left">주소</th>
                  <th className="px-3 py-2 text-left">위탁업체</th>
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
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[280px] truncate" title={f.address ?? ''}>{f.address ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{f.contractorName}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                        f.active ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-slate-200 text-slate-600 border-slate-400'
                      }`}>
                        {f.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(f)} className="text-xs font-bold text-accent hover:underline mr-2">수정</button>
                      <button onClick={() => toggleActive(f)} className="text-xs font-bold text-amber-700 hover:underline">
                        {f.active ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <FacilityFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editing && <FacilityFormModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function FacilityFormModal({ initial, onClose, onSaved }: {
  initial?: Facility;
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
    const body = {
      type: form.type,
      name: form.name.trim(),
      address: form.address.trim() || null,
    };
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) onSaved();
    else {
      const e = await res.json().catch(() => ({}));
      setError(e.error === 'duplicate_facility' ? '이미 동일한 분류·이름의 시설이 등록되어 있습니다.' : (e.error ?? '저장 실패'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line bg-purple-50">
          <h3 className="font-extrabold text-ink">{initial ? '처리시설 수정' : '처리시설 신규 등록'}</h3>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <div className="text-[11px] font-mono font-extrabold text-slate-600 mb-1">분류</div>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as FacilityType })}
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold">
              {FACILITY_TYPES.map((t) => <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11px] font-mono font-extrabold text-slate-600 mb-1">시설명 *</div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: ○○구 자원순환센터"
              className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-extrabold text-slate-600 mb-1">주소</div>
            <input
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
