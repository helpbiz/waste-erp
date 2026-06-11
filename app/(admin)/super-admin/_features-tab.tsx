'use client';

/**
 * 회사별 기능 권한 매트릭스 — SUPER_ADMIN 전용 탭.
 *
 * 좌측: 회사 목록(검색 + 활성 기능 카운트 뱃지)
 * 우측: 선택된 회사의 기능 카탈로그(group 별 묶음, 체크박스 즉시 PATCH)
 */
import { useEffect, useMemo, useState } from 'react';

type FeaturePackageInfo = {
  key: 'TRIAL' | 'BASIC' | 'STANDARD' | 'PRO';
  label: string;
  description: string;
  badge: string;
  monthlyHint: string;
  features: Record<string, boolean>;
};

type ListResponse = {
  catalog: { key: string; label: string; description: string; group: string; defaultEnabled: boolean }[];
  packages: FeaturePackageInfo[];
  contractors: {
    id: string;
    companyName: string;
    municipalityName: string | null;
    enabledCount: number;
    totalCount: number;
    customCount: number;
    currentPackage: 'TRIAL' | 'BASIC' | 'STANDARD' | 'PRO' | null;
  }[];
};

type DetailResponse = {
  contractorId: string;
  catalog: ListResponse['catalog'];
  packages: FeaturePackageInfo[];
  currentPackage: 'TRIAL' | 'BASIC' | 'STANDARD' | 'PRO' | null;
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
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        setList(d);
        if (!selected && d.contractors?.length > 0) setSelected(d.contractors[0].id);
      })
      .catch(() => null);
  }

  function loadDetail(id: string) {
    fetch(`/api/super-admin/contractor-features?contractorId=${id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
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

  async function applyPackage(packageKey: string) {
    if (!selected) return;
    const pkg = detail?.packages.find((p) => p.key === packageKey);
    const companyName = list?.contractors.find((c) => c.id === selected)?.companyName ?? '';
    if (!pkg) return;
    if (!confirm(
      `[${companyName}] 회사에 [${pkg.label}] 패키지를 적용합니다.\n\n` +
      `▸ 기존 커스텀 설정이 패키지 정의로 덮어쓰기됩니다.\n` +
      `▸ 8개 기능 중 활성: ${Object.values(pkg.features).filter(Boolean).length}개\n\n` +
      `진행하시겠습니까?`
    )) return;

    setBusy(true);
    const r = await fetch('/api/super-admin/contractor-features/apply-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId: selected, packageKey }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('패키지 적용 실패: ' + (j.error ?? 'unknown'));
      return;
    }
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
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-sm font-bold text-amber-900">
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
          {!list && <div className="text-sm text-ink-faint text-center py-6">로딩 중…</div>}
          {list && filtered.length === 0 && (
            <div className="text-sm text-ink-faint text-center py-6">검색 결과 없음</div>
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
                  <div className="text-[0.6875rem] text-ink-faint mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {c.municipalityName && <span>🏛 {c.municipalityName}</span>}
                    {c.currentPackage ? (
                      <span className="px-1.5 py-0.5 rounded font-extrabold bg-cyan-100 text-cyan-800 border border-cyan-300">
                        📦 {c.currentPackage}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded font-extrabold bg-amber-100 text-amber-800">
                        🛠 커스텀
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded font-extrabold ${allOn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-ink-muted'}`}>
                      {c.enabledCount}/{c.totalCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측 — 기능 매트릭스 */}
        <div className="bg-surface border border-line rounded-lg p-4 min-h-[400px]">
          {!selected && <div className="text-sm text-ink-faint text-center py-12">왼쪽에서 회사를 선택하세요</div>}
          {selected && !detail && <div className="text-sm text-ink-faint text-center py-12">로딩 중…</div>}
          {detail && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-black text-ink">
                  {list?.contractors.find((c) => c.id === selected)?.companyName ?? '—'}
                </h3>
                <span className="text-[0.6875rem] font-mono text-ink-faint">contractorId: {selected}</span>
                {detail.currentPackage ? (
                  <span className="text-sm font-extrabold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                    📦 현재: {detail.currentPackage}
                  </span>
                ) : (
                  <span className="text-sm font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    🛠 커스텀 (패키지 미일치)
                  </span>
                )}
                {busy && <span className="text-sm text-amber-700 font-bold">저장 중…</span>}
              </div>

              {/* 요금제 패키지 일괄 적용 */}
              <section className="border-2 border-purple-200 bg-purple-50/50 rounded-lg p-3">
                <div className="text-sm font-extrabold text-purple-900 mb-2 flex items-center gap-2">
                  📦 요금제 패키지 일괄 적용
                  <span className="text-[0.625rem] font-bold text-ink-faint font-mono">
                    (8개 기능 모두 패키지 정의로 덮어쓰기)
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {detail.packages.map((p) => {
                    const isCurrent = detail.currentPackage === p.key;
                    const enabledCount = Object.values(p.features).filter(Boolean).length;
                    return (
                      <div
                        key={p.key}
                        className={`border-2 rounded-lg p-2.5 text-left bg-white ${
                          isCurrent ? 'border-purple-500 ring-2 ring-purple-200' : 'border-line'
                        }`}
                      >
                        <div className="text-sm font-extrabold text-ink">{p.label}</div>
                        <div className="text-[0.625rem] text-ink-faint mt-0.5 leading-snug">
                          {p.description}
                        </div>
                        <div className="text-[0.625rem] font-mono text-ink-faint mt-1">
                          기능 {enabledCount}/8 · {p.monthlyHint}
                        </div>
                        <button
                          onClick={() => applyPackage(p.key)}
                          disabled={busy || isCurrent}
                          className={`mt-2 w-full px-2 py-1 rounded text-[0.6875rem] font-extrabold transition active:scale-95 ${
                            isCurrent
                              ? 'bg-slate-200 text-ink-faint cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          } ${busy && !isCurrent ? 'opacity-50' : ''}`}
                        >
                          {isCurrent ? '✓ 현재 적용중' : '✓ 적용'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {Array.from(grouped.entries()).map(([group, features]) => (
                <section key={group}>
                  <h4 className="text-sm font-extrabold text-ink-faint mb-2 uppercase tracking-wide">{group}</h4>
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
                            <span className={`text-sm font-extrabold ${f.enabled ? 'text-ink' : 'text-ink-faint line-through'}`}>
                              {f.label}
                            </span>
                            <span className="text-[0.6875rem] font-mono text-ink-faint">{f.key}</span>
                            {f.isDefault && (
                              <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-ink-muted">
                                기본값
                              </span>
                            )}
                            {!f.isDefault && (
                              <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-purple-200 text-purple-800">
                                커스텀
                              </span>
                            )}
                          </div>
                          <div className="text-[0.6875rem] text-ink-faint mt-0.5">{f.description}</div>
                          {!f.isDefault && f.updatedAt && (
                            <div className="text-[0.625rem] font-mono text-ink-faint mt-1">
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
