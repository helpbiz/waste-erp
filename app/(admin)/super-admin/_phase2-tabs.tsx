'use client';

/**
 * Phase 2 탭 4종 — 슈퍼관리자 콘솔 신규 메뉴.
 * Design Ref: docs/specs/08_역할권한_설계서.md §6.2 + §9.
 *
 * - UsersGlobalTab (P2-1): 전체 사용자 검색·잠금·PW 리셋
 * - SystemStatsTab (P2-2): 활성 사용자·DB·로그인 통계
 * - AuditLogTab (P2-3): audit_log 검색·필터·페이지네이션
 * - OrgTreeTab (P2-4): 헬프비즈 → 지자체 → 위탁업체 트리
 */
import { useEffect, useMemo, useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '시스템관리자',
  MUNI_ADMIN: '지자체관리자',
  CONTRACTOR_ADMIN: '회사관리자',
  INTERNAL_ADMIN: '일반관리자',
  WORKER: '일반근로자',
};

/* ─────────── P2-1 사용자 (전체) ─────────── */
type GlobalUser = {
  id: string; username: string; name: string; role: string; status: string;
  contractorName: string | null; municipalityName: string | null;
  lastLogin: string | null; failedLoginAttempts: number; lockedUntil: string | null;
  isLocked: boolean;
};

export function UsersGlobalTab() {
  const [items, setItems] = useState<GlobalUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [lockedOnly, setLockedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);

  function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (role) p.set('role', role);
    if (status) p.set('status', status);
    if (lockedOnly) p.set('lockedOnly', 'true');
    p.set('page', String(page));
    fetch(`/api/super-admin/users-global?${p}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, role, status, lockedOnly]);

  async function toggleLock(u: GlobalUser) {
    const action = u.isLocked ? 'unlock' : 'lock';
    if (!confirm(`${u.username} (${u.name}) 사용자를 ${action === 'lock' ? '잠그시겠' : '잠금 해제하시'}겠습니까?`)) return;
    const r = await fetch(`/api/super-admin/users/${u.id}/lock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (r.ok) load();
    else alert('실패');
  }

  async function resetPw(u: GlobalUser) {
    if (!confirm(`${u.username} 비밀번호를 임시 PW로 강제 재설정합니다. 계속하시겠습니까?`)) return;
    const r = await fetch(`/api/super-admin/users/${u.id}/reset-pw`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.tempPassword) {
      setResetResult({ username: u.username, tempPassword: j.tempPassword });
      load();
    } else alert('실패');
  }

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="bg-surface border border-line rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">검색</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
            placeholder="이름·아이디·사번"
            className="w-48 px-3 py-1.5 rounded border border-line text-sm"
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded border border-line text-sm">
          <option value="">권한 전체</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded border border-line text-sm">
          <option value="">상태 전체</option>
          <option value="ACTIVE">활성</option>
          <option value="INACTIVE">비활성</option>
          <option value="PENDING">대기</option>
        </select>
        <label className="flex items-center gap-1 text-xs font-bold">
          <input type="checkbox" checked={lockedOnly} onChange={(e) => { setLockedOnly(e.target.checked); setPage(1); }} />
          잠금만
        </label>
        <button onClick={() => { setPage(1); load(); }} className="ml-auto px-3 py-1.5 rounded bg-accent text-white text-xs font-extrabold">검색</button>
      </div>

      {resetResult && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3">
          <div className="text-sm font-extrabold text-amber-900 mb-1">🔑 임시 PW 발급됨 (1회만 표시)</div>
          <div className="font-mono text-sm">
            <b>{resetResult.username}</b> → <code className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">{resetResult.tempPassword}</code>
          </div>
          <button onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)} className="mt-2 px-2 py-1 rounded bg-amber-600 text-white text-xs font-bold">📋 PW 복사</button>
          <button onClick={() => setResetResult(null)} className="mt-2 ml-1.5 px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold">닫기</button>
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-100 border-b border-line text-xs font-extrabold text-ink">
          전체 {total}명 · 페이지 {page} / {Math.ceil(total / 50)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">이름</th>
                <th className="px-2 py-2 text-left">아이디</th>
                <th className="px-2 py-2 text-left">권한</th>
                <th className="px-2 py-2 text-left">소속</th>
                <th className="px-2 py-2 text-left">상태</th>
                <th className="px-2 py-2 text-left">최근 접속</th>
                <th className="px-2 py-2 text-right">실패</th>
                <th className="px-2 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">로딩 중…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">결과 없음</td></tr>}
              {items.map((u) => (
                <tr key={u.id} className={u.isLocked ? 'bg-rose-50' : ''}>
                  <td className="px-2 py-2 font-bold text-ink">{u.name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{u.username}</td>
                  <td className="px-2 py-2">
                    <span className="text-[0.625rem] font-mono font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {u.contractorName ?? u.municipalityName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    {u.isLocked && <span className="text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">🔒 잠금</span>}
                    {!u.isLocked && (
                      <span className={`text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded border ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        u.status === 'INACTIVE' ? 'bg-slate-200 text-slate-700 border-slate-400' :
                        'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>{u.status}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-[0.6875rem] text-slate-600">{u.lastLogin ? u.lastLogin.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td className="px-2 py-2 text-right font-mono">{u.failedLoginAttempts}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button onClick={() => toggleLock(u)} className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-rose-600 text-white hover:bg-rose-700 mr-1">
                      {u.isLocked ? '🔓 해제' : '🔒 잠금'}
                    </button>
                    <button onClick={() => resetPw(u)} className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-amber-600 text-white hover:bg-amber-700">
                      🔑 PW
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-slate-50 border-t border-line flex items-center justify-between">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded bg-slate-200 text-xs font-bold disabled:opacity-40">← 이전</button>
          <span className="text-xs font-mono text-slate-600">{page} / {Math.max(1, Math.ceil(total / 50))}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded bg-slate-200 text-xs font-bold disabled:opacity-40">다음 →</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── P2-2 시스템 모니터링 ─────────── */
type SystemStats = {
  timestamp: string;
  db: { sizeMb: number | null };
  users: { total: number; active: number; locked: number; activeWithin7d: number };
  contractors: { total: number; active: number };
  municipalities: { total: number };
  login24h: { success: number; failed: number; locked: number; errorRate: number };
  auditEvents7d: number;
};

export function SystemStatsTab() {
  const [data, setData] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch('/api/super-admin/system-stats')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // 30초 자동 새로고침
    return () => clearInterval(t);
  }, []);

  if (loading && !data) return <div className="text-center py-10 text-slate-500">로딩 중…</div>;
  if (!data) return <div className="text-center py-10 text-rose-600">데이터 로드 실패</div>;

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-slate-500 text-right">
        업데이트: {data.timestamp.slice(0, 19).replace('T', ' ')} (30초마다 자동)
      </div>
      <Section title="📊 시스템 현황">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="전체 사용자" value={`${data.users.total}명`} />
          <Stat label="활성 사용자" value={`${data.users.active}명`} tone="success" />
          <Stat label="7일 내 접속" value={`${data.users.activeWithin7d}명`} tone="accent" />
          <Stat label="잠금 계정" value={`${data.users.locked}명`} tone={data.users.locked > 0 ? 'warning' : 'default'} />
        </div>
      </Section>
      <Section title="🏢 회사 / 지자체">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="전체 위탁업체" value={`${data.contractors.total}곳`} />
          <Stat label="활성 위탁업체" value={`${data.contractors.active}곳`} tone="success" />
          <Stat label="등록 지자체" value={`${data.municipalities.total}곳`} />
          <Stat label="DB 사이즈" value={data.db.sizeMb !== null ? `${data.db.sizeMb} MB` : '—'} tone="accent" />
        </div>
      </Section>
      <Section title="🔐 로그인 (최근 24h)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="성공" value={`${data.login24h.success}회`} tone="success" />
          <Stat label="실패" value={`${data.login24h.failed}회`} tone={data.login24h.failed > 0 ? 'warning' : 'default'} />
          <Stat label="자동 잠금" value={`${data.login24h.locked}회`} tone={data.login24h.locked > 0 ? 'danger' : 'default'} />
          <Stat label="에러율" value={`${data.login24h.errorRate}%`} tone={data.login24h.errorRate > 20 ? 'danger' : data.login24h.errorRate > 5 ? 'warning' : 'success'} />
        </div>
      </Section>
      <Section title="📜 감사 로그">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="7일 누적 이벤트" value={`${data.auditEvents7d.toLocaleString()}건`} tone="accent" />
        </div>
      </Section>
    </div>
  );
}

/* ─────────── P2-3 감사 로그 뷰어 ─────────── */
type AuditItem = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actor: { username: string; name: string } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  contractorId: string | null;
  contractorName: string | null;
  municipalityId: string | null;
  municipalityName: string | null;
  municipalityCode: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

export function AuditLogTab() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [contractorFilter, setContractorFilter] = useState(''); // contractorId 또는 회사명
  const [municipalityFilter, setMunicipalityFilter] = useState(''); // muni id/name
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    if (actorRole) p.set('actorRole', actorRole);
    /* contractor/muni 는 숫자(id) 또는 이름 — 숫자면 서버 필터, 이름이면 클라이언트 필터 */
    if (contractorFilter && /^\d+$/.test(contractorFilter)) p.set('contractorId', contractorFilter);
    if (municipalityFilter && /^\d+$/.test(municipalityFilter)) p.set('municipalityId', municipalityFilter);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('page', String(page));
    fetch(`/api/super-admin/audit-log?${p}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, actorRole, contractorFilter, municipalityFilter, from, to]);

  /* 이름 기반 클라이언트 필터 — 숫자 id 가 아닌 경우 적용 */
  const filteredItems = useMemo(() => {
    let r = items;
    if (contractorFilter && !/^\d+$/.test(contractorFilter)) {
      r = r.filter((i) => (i.contractorName ?? '').includes(contractorFilter));
    }
    if (municipalityFilter && !/^\d+$/.test(municipalityFilter)) {
      r = r.filter((i) => (i.municipalityName ?? '').includes(municipalityFilter));
    }
    return r;
  }, [items, contractorFilter, municipalityFilter]);

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-line rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">액션</div>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="LOGIN_SUCCESS 등" className="w-44 px-2 py-1.5 rounded border border-line text-sm" />
        </div>
        <select value={actorRole} onChange={(e) => { setActorRole(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded border border-line text-sm">
          <option value="">권한 전체</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">회사 (id 또는 이름)</div>
          <input
            value={contractorFilter}
            onChange={(e) => { setContractorFilter(e.target.value); setPage(1); }}
            placeholder="강남청소 / 12"
            className="w-40 px-2 py-1.5 rounded border border-line text-sm"
          />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">지자체 (id 또는 이름)</div>
          <input
            value={municipalityFilter}
            onChange={(e) => { setMunicipalityFilter(e.target.value); setPage(1); }}
            placeholder="용산구 / 21"
            className="w-40 px-2 py-1.5 rounded border border-line text-sm"
          />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded border border-line text-sm" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded border border-line text-sm" />
        </div>
        <button onClick={() => { setPage(1); load(); }} className="ml-auto px-3 py-1.5 rounded bg-accent text-white text-xs font-extrabold">검색</button>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-100 border-b border-line text-xs font-extrabold text-ink">
          {total.toLocaleString()}건 · 페이지 {page} / {Math.max(1, Math.ceil(total / 50))}
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs min-w-[1000px]">
            <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-700 uppercase sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left">시간</th>
                <th className="px-2 py-1.5 text-left">행위자</th>
                <th className="px-2 py-1.5 text-left">권한</th>
                <th className="px-2 py-1.5 text-left">액션</th>
                <th className="px-2 py-1.5 text-left">대상</th>
                <th className="px-2 py-1.5 text-left">소속 회사</th>
                <th className="px-2 py-1.5 text-left">관할 지자체</th>
                <th className="px-2 py-1.5 text-left">IP</th>
                <th className="px-2 py-1.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">로딩 중…</td></tr>}
              {!loading && filteredItems.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">결과 없음</td></tr>}
              {filteredItems.map((i) => (
                <>
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1 font-mono text-[0.6875rem] text-slate-700 whitespace-nowrap">{i.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-2 py-1 font-bold">{i.actor?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-2 py-1 font-mono text-[0.625rem]">{i.actorRole ? (ROLE_LABEL[i.actorRole] ?? i.actorRole) : '—'}</td>
                    <td className="px-2 py-1">
                      <code className="text-[0.6875rem] font-mono font-extrabold px-1 rounded bg-blue-100 text-blue-900">{i.action}</code>
                    </td>
                    <td className="px-2 py-1 font-mono text-[0.6875rem]">{i.resourceType}{i.resourceId ? ` #${i.resourceId}` : ''}</td>
                    <td className="px-2 py-1 text-[0.6875rem]">
                      {i.contractorName ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-bold text-emerald-800">{i.contractorName}</span>
                          <span className="text-[0.5625rem] font-mono text-slate-400">#{i.contractorId}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-[0.6875rem]">
                      {i.municipalityName ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-bold text-cyan-800">{i.municipalityName}</span>
                          {i.municipalityCode && <span className="text-[0.5625rem] font-mono text-slate-400">{i.municipalityCode}</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 font-mono text-[0.625rem] text-slate-500">{i.ipAddress ?? '—'}</td>
                    <td className="px-2 py-1 text-right">
                      {i.metadata != null && (
                        <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="text-[0.625rem] text-accent font-bold hover:underline">
                          {expanded === i.id ? '접기' : '메타'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === i.id && (
                    <tr key={i.id + '-exp'} className="bg-slate-100">
                      <td colSpan={9} className="px-3 py-2">
                        <pre className="text-[0.625rem] font-mono whitespace-pre-wrap break-all text-slate-700">{JSON.stringify(i.metadata, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-slate-50 border-t border-line flex items-center justify-between">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded bg-slate-200 text-xs font-bold disabled:opacity-40">← 이전</button>
          <span className="text-xs font-mono text-slate-600">{page} / {Math.max(1, Math.ceil(total / 50))}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded bg-slate-200 text-xs font-bold disabled:opacity-40">다음 →</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── P2-4 조직 트리 ─────────── */
type OrgTree = {
  superAdminCount: number;
  municipalities: Array<{
    id: string; name: string; code: string; region: string | null; status: string; muniAdmins: number;
    contractors: Array<{ id: string; name: string; status: string; counts: Record<string, number> }>;
  }>;
};

export function OrgTreeTab() {
  const [data, setData] = useState<OrgTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMuni, setExpandedMuni] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState('');

  useEffect(() => {
    fetch('/api/super-admin/org-tree')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!region) return data.municipalities;
    return data.municipalities.filter((m) => (m.region ?? '').includes(region));
  }, [data, region]);

  if (loading) return <div className="text-center py-10 text-slate-500">로딩 중…</div>;
  if (!data) return <div className="text-center py-10 text-rose-600">데이터 로드 실패</div>;

  function toggle(id: string) {
    setExpandedMuni((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-3">
      <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <div className="flex-1">
            <div className="text-sm font-black text-purple-900">헬프비즈 (운영사)</div>
            <div className="text-[0.6875rem] font-mono text-purple-700">SUPER_ADMIN: {data.superAdminCount}명</div>
          </div>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="🔍 지역 필터 (예: 서울)"
            className="px-2 py-1 rounded border border-purple-300 text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map((m) => {
          const isOpen = expandedMuni.has(m.id);
          const totalUsers = m.contractors.reduce((s, c) => s + Object.values(c.counts).reduce((a, b) => a + b, 0), 0);
          return (
            <div key={m.id} className="bg-surface border border-line rounded-lg overflow-hidden">
              <button onClick={() => toggle(m.id)} className="w-full px-3 py-2 bg-cyan-50 hover:bg-cyan-100 flex items-center gap-2 text-left">
                <span className="text-base">🏛</span>
                <span className="font-extrabold text-ink text-sm">{m.name}</span>
                <span className="text-[0.625rem] font-mono text-slate-500">{m.region ?? ''} · {m.code}</span>
                <span className="ml-auto text-[0.625rem] font-mono font-bold text-cyan-800">
                  업체 {m.contractors.length}곳 · MUNI_ADMIN {m.muniAdmins}명 · 직원 {totalUsers}명
                </span>
                <span className="text-xs font-mono text-slate-500">{isOpen ? '▼' : '▶'}</span>
              </button>
              {isOpen && (
                <div className="px-3 py-2 space-y-1.5 border-t border-cyan-200">
                  {m.contractors.length === 0 && <div className="text-xs text-slate-500">등록된 위탁업체 없음</div>}
                  {m.contractors.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-line bg-slate-50">
                      <span className="text-base">🏢</span>
                      <span className="font-bold text-sm">{c.name}</span>
                      <span className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-300">{c.status}</span>
                      <span className="ml-auto text-[0.625rem] font-mono font-extrabold text-slate-700">
                        대표 {c.counts.CONTRACTOR_ADMIN ?? 0} · 팀장 {c.counts.INTERNAL_ADMIN ?? 0} · 워커 {c.counts.WORKER ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-slate-500">조건에 맞는 지자체 없음</div>}
      </div>
    </div>
  );
}

/* ─────────── 공통 ─────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-extrabold text-ink mb-2">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent' }) {
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    success: 'bg-emerald-50 border-emerald-400 text-emerald-900',
    warning: 'bg-amber-50 border-amber-400 text-amber-900',
    danger: 'bg-rose-50 border-rose-400 text-rose-900',
    accent: 'bg-cyan-50 border-cyan-400 text-cyan-900',
  };
  return (
    <div className={`px-3 py-2.5 rounded-lg border-2 text-center ${c[tone]}`}>
      <div className="text-[0.625rem] font-mono font-extrabold uppercase opacity-70">{label}</div>
      <div className="text-base font-black mt-1">{value}</div>
    </div>
  );
}
