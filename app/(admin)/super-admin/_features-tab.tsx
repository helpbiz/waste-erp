'use client';

/**
 * 회사별 기능 권한 매트릭스 — SUPER_ADMIN 전용 탭.
 *
 * 좌측: 회사 목록(검색 + 활성 기능 카운트 뱃지)
 * 우측: 선택된 회사의 기능 카탈로그(group 별 묶음, 체크박스 즉시 PATCH)
 */
import { useEffect, useMemo, useState } from 'react';

type ListResponse = {
  catalog: { key: string; label: string; description: string; group: string; defaultEnabled: boolean }[];
  contractors: {
    id: string;
    companyName: string;
    municipalityName: string | null;
    enabledCount: number;
    totalCount: number;
    customCount: number;
  }[];
};

type DetailResponse = {
  contractorId: string;
  catalog: ListResponse['catalog'];
  features: {
    key: string;
    label: string;
    description: string;
    group: string;
    enabled: boolean;
    isDefault: boolean;
    updatedAt: string | null;
    updatedBy: string | null;
  }[];
};

export default function ContractorFeaturesTab() {
  const [list, setList] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  function loadList() {
    fetch('/api/super-admin/contractor-features')
      .then((r) => r.json())
      .then((d) => {
        setList(d);
        if (!selected && d.contractors?.length > 0) setSelected(d.contractors[0].id);
      })
      .catch(() => null);
  }

  function loadDetail(id: string) {
    fetch(`/api/super-admin/contractor-features?contractorId=${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => null);
  }

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (selected) loadDetail(selected);
    else setDetail(null);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    if (!q) return list.contractors;
    return list.contractors.filter((c) =>
      c.companyName.toLowerCase().includes(q) ||
      (c.municipalityName ?? '').toLowerCase().includes(q),
    );
  }, [list, search]);

  async function toggle(featureKey: string, enabled: boolean) {
    if (!selected) return;
    setBusy(true);
    const r = await fetch('/api/super-admin/contractor-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId: selected, featureKey, enabled }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('실패: ' + (j.error ?? 'unknown'));
      return;
    }
    /* 즉시 반영 — 상세 + 리스트 모두 재로드 */
    loadDetail(selected);
    loadList();
  }

  /* group 별 분류 */
  const grouped = useMemo(() => {
    if (!detail) return new Map<string, DetailResponse['features']>();
    const m = new Map<string, DetailResponse['features']>();
    for (const f of detail.features) {
      const arr = m.get(f.group) ?? [];
      arr.push(f);
      m.set(f.group, arr);
    }
    return m;
  }, [detail]);

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-xs font-bold text-amber-900">
        ⓘ 기능을 OFF 하면 해당 회사의 사용자는 즉시 그 기능에 접근할 수 없습니다(서버 측 차단). 신규 회사는
        모든 기능이 기본 ON 입니다. 변경 즉시 저장됩니다.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
        {/* 좌측 — 회사 리스트 */}
        <div className="bg-surface border border-line rounded-lg p-3 max-h-[80vh] overflow-y-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사명·지자체 검색"
            className="w-full px-3 py-2 mb-2 rounded border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
          />
          {!list && <div className="text-xs text-slate-500 text-center py-6">로딩 중…</div>}
          {list && filtered.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-6">검색 결과 없음</div>
          )}
          <div className="space-y-1">
            {filtered.map((c) => {
              const active = selected === c.id;
              const allOn = c.enabledCount === c.totalCount;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border-2 transition ${
                    active ? 'border-purple-500 bg-purple-50' : 'border-line bg-white hover:border-purple-300'
                  }`}
                >
                  <div className="text-sm font-extrabold text-ink">{c.companyName}</div>
                  <div className="text-[0.6875rem] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {c.municipalityName && <span>🏛 {c.municipalityName}</span>}
                    <span className={`px-1.5 py-0.5 rounded font-extrabold ${allOn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {c.enabledCount}/{c.totalCount} 활성
                    </span>
                    {c.customCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-extrabold">
                        커스텀 {c.customCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측 — 기능 매트릭스 */}
        <div className="bg-surface border border-line rounded-lg p-4 min-h-[400px]">
          {!selected && <div className="text-sm text-slate-500 text-center py-12">왼쪽에서 회사를 선택하세요</div>}
          {selected && !detail && <div className="text-sm text-slate-500 text-center py-12">로딩 중…</div>}
          {detail && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-black text-ink">
                  {list?.contractors.find((c) => c.id === selected)?.companyName ?? '—'}
                </h3>
                <span className="text-[0.6875rem] font-mono text-slate-500">contractorId: {selected}</span>
                {busy && <span className="text-xs text-amber-700 font-bold">저장 중…</span>}
              </div>

              {Array.from(grouped.entries()).map(([group, features]) => (
                <section key={group}>
                  <h4 className="text-xs font-extrabold text-slate-600 mb-2 uppercase tracking-wide">{group}</h4>
                  <div className="space-y-2">
                    {features.map((f) => (
                      <label
                        key={f.key}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition ${
                          f.enabled
                            ? 'border-emerald-300 bg-emerald-50/30'
                            : 'border-rose-300 bg-rose-50/30 opacity-75'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={f.enabled}
                          disabled={busy}
                          onChange={(e) => toggle(f.key, e.target.checked)}
                          className="mt-0.5 w-5 h-5 accent-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-extrabold ${f.enabled ? 'text-ink' : 'text-slate-500 line-through'}`}>
                              {f.label}
                            </span>
                            <span className="text-[0.6875rem] font-mono text-slate-400">{f.key}</span>
                            {f.isDefault && (
                              <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                기본값
                              </span>
                            )}
                            {!f.isDefault && (
                              <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-purple-200 text-purple-800">
                                커스텀
                              </span>
                            )}
                          </div>
                          <div className="text-[0.6875rem] text-slate-600 mt-0.5">{f.description}</div>
                          {!f.isDefault && f.updatedAt && (
                            <div className="text-[0.625rem] font-mono text-slate-400 mt-1">
                              마지막 변경: {new Date(f.updatedAt).toLocaleString('ko-KR')}
                              {f.updatedBy && <> · userId {f.updatedBy}</>}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
