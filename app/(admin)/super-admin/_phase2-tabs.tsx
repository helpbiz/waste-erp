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
import { useUsernameCheck } from '@/lib/use-username-check';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ username: string; tempPassword: string; role: string; name: string } | null>(null);

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
        <button onClick={() => setCreateOpen(true)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm">
          ＋ 신규 사용자 등록
        </button>
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={(info) => { setCreatedInfo(info); setCreateOpen(false); load(); }}
        />
      )}

      {createdInfo && (
        <CreatedInfoBox info={createdInfo} onClose={() => setCreatedInfo(null)} />
      )}

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

/* ─────────── 신규 등록 결과 박스 (복사 버튼 다단 fallback) ─────────── */

function CreatedInfoBox({ info, onClose }: { info: { username: string; tempPassword: string; role: string; name: string }; onClose: () => void }) {
  const [copyOk, setCopyOk] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const text = `CleanERP 신규 ${ROLE_LABEL[info.role] ?? info.role} 계정\n────────────────\n접속 URL: https://wci.helpbiz.kr/login\n이름: ${info.name}\n아이디: ${info.username}\n임시 PW: ${info.tempPassword}\n\n※ 첫 로그인 후 비밀번호를 변경해 주세요.`;

  async function copy() {
    /* Strategy 1: 모던 Clipboard API (HTTPS / localhost) */
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        setCopyOk(true);
        setTimeout(() => setCopyOk(false), 2000);
        return;
      } catch { /* fallback */ }
    }
    /* Strategy 2: 레거시 execCommand (HTTP 환경) */
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        setCopyOk(true);
        setTimeout(() => setCopyOk(false), 2000);
        return;
      }
    } catch { /* fallback */ }
    /* Strategy 3: 수동 복사 영역 펼침 */
    setShowManual(true);
  }

  return (
    <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3">
      <div className="text-sm font-extrabold text-emerald-900 mb-1">
        ✓ {ROLE_LABEL[info.role] ?? info.role} 신규 등록 완료 — 1회 표시
      </div>
      <div className="font-mono text-sm space-y-1">
        <div><b>이름:</b> {info.name}</div>
        <div><b>아이디:</b> <code className="px-1 rounded bg-white border">{info.username}</code></div>
        <div><b>임시 PW:</b> <code className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">{info.tempPassword}</code></div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={copy}
          className={`px-2.5 py-1 rounded text-xs font-extrabold transition ${
            copyOk ? 'bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {copyOk ? '✓ 복사됨!' : '📋 클립보드 복사 (메일/메신저용)'}
        </button>
        <button onClick={onClose} className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold">닫기</button>
      </div>
      {showManual && (
        <div className="mt-2 bg-amber-50 border border-amber-400 rounded-md px-3 py-2">
          <div className="text-[0.6875rem] font-extrabold text-amber-900 mb-1.5">
            ⚠ 자동 복사 차단 (HTTP 접속). 아래 박스 클릭 후 <b>Ctrl+C</b> (Mac: <b>Cmd+C</b>):
          </div>
          <textarea
            readOnly
            value={text}
            rows={6}
            ref={(ta) => { if (ta) { ta.focus(); ta.select(); } }}
            onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
            className="w-full px-2 py-1.5 rounded border border-amber-300 bg-white text-xs font-mono"
          />
        </div>
      )}
    </div>
  );
}

/* ─────────── username 자동 unique 검사 (모달용) ─────────── */
function UsernameLivenStatus({ username, onPick }: { username: string; onPick: (s: string) => void }) {
  const { status, suggestions } = useUsernameCheck(username);
  if (status === 'idle') {
    return <div className="text-[0.625rem] text-slate-500 mt-1">3~30자 영문/숫자/_-, 시스템 전체 unique</div>;
  }
  if (status === 'invalid') {
    return <div className="text-[0.6875rem] font-bold text-rose-700 mt-1">⚠ 형식 오류 — 영문/숫자/_- 만 (3~30자)</div>;
  }
  if (status === 'checking') {
    return <div className="text-[0.6875rem] text-slate-500 mt-1">중복 검사 중…</div>;
  }
  if (status === 'available') {
    return <div className="text-[0.6875rem] font-bold text-emerald-700 mt-1">✓ 사용 가능</div>;
  }
  return (
    <div className="mt-1 space-y-1">
      <div className="text-[0.6875rem] font-bold text-rose-700">⚠ 이미 사용 중</div>
      {suggestions.length > 0 && (
        <div className="text-[0.625rem] text-slate-700">
          <span className="font-bold">추천 대안:</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className="px-1.5 py-0.5 rounded border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono font-bold"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── 신규 사용자 등록 모달 (모든 role 지원) ───────────
   MUNI_ADMIN / CONTRACTOR_ADMIN / INTERNAL_ADMIN / WORKER 모두 등록.
   role 별 필수 컨텍스트:
     - MUNI_ADMIN: municipalityId
     - 그 외: contractorId */

type RoleKey = 'MUNI_ADMIN' | 'CONTRACTOR_ADMIN' | 'INTERNAL_ADMIN' | 'WORKER';

const CREATE_ROLE_OPTIONS: Array<{ key: RoleKey; label: string; ctx: 'muni' | 'contractor' }> = [
  { key: 'MUNI_ADMIN',       label: '지자체관리자 (MUNI_ADMIN)',     ctx: 'muni' },
  { key: 'CONTRACTOR_ADMIN', label: '회사관리자 (CONTRACTOR_ADMIN)', ctx: 'contractor' },
  { key: 'INTERNAL_ADMIN',   label: '일반관리자 (INTERNAL_ADMIN)',   ctx: 'contractor' },
  { key: 'WORKER',           label: '일반근로자 (WORKER)',           ctx: 'contractor' },
];

function genTempPw(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (info: { username: string; tempPassword: string; role: string; name: string }) => void }) {
  const [role, setRole] = useState<RoleKey>('MUNI_ADMIN');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(() => genTempPw());
  const [phone, setPhone] = useState('');
  const [muniId, setMuniId] = useState('');
  const [muniQuery, setMuniQuery] = useState('');
  const [muniList, setMuniList] = useState<Array<{ id: string; name: string; code: string; region: string | null; status: string }>>([]);
  const [contractorId, setContractorId] = useState('');
  const [contractorQuery, setContractorQuery] = useState('');
  const [contractorList, setContractorList] = useState<Array<{ id: string; companyName: string; municipalityName: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = CREATE_ROLE_OPTIONS.find((r) => r.key === role)!.ctx;

  /* role 변경 시 컨텍스트 리셋 */
  useEffect(() => {
    if (ctx === 'muni') setContractorId('');
    else setMuniId('');
  }, [ctx]);

  /* muni 목록 로드 (role=MUNI_ADMIN 시) */
  useEffect(() => {
    if (ctx !== 'muni' || muniList.length > 0) return;
    fetch('/api/super-admin/municipalities?limit=500')
      .then((r) => r.json())
      .then((d) => setMuniList(d.items ?? []))
      .catch(() => null);
  }, [ctx, muniList.length]);

  /* contractor 목록 로드 (그 외 role) */
  useEffect(() => {
    if (ctx !== 'contractor' || contractorList.length > 0) return;
    fetch('/api/contractors')
      .then((r) => r.json())
      .then((d) => setContractorList(d.items ?? []))
      .catch(() => null);
  }, [ctx, contractorList.length]);

  const filteredMunis = useMemo(() => {
    const q = muniQuery.trim();
    if (!q) return muniList.slice(0, 20);
    return muniList.filter((m) => m.name.includes(q) || (m.region ?? '').includes(q) || m.code.includes(q)).slice(0, 50);
  }, [muniList, muniQuery]);

  const filteredContractors = useMemo(() => {
    const q = contractorQuery.trim();
    if (!q) return contractorList.slice(0, 20);
    return contractorList.filter((c) => c.companyName.includes(q) || (c.municipalityName ?? '').includes(q)).slice(0, 50);
  }, [contractorList, contractorQuery]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('이름 필수');
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) return setError('아이디 3~30자 영문/숫자/_-');
    if (password.length < 6) return setError('비밀번호 6자 이상');
    if (phone && !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone)) return setError('전화번호 010-XXXX-XXXX');
    if (ctx === 'muni' && !muniId) return setError('관할 지자체 선택 필수');
    if (ctx === 'contractor' && !contractorId) return setError('소속 회사 선택 필수');

    setBusy(true);
    const body: Record<string, unknown> = {
      username: username.trim(),
      password,
      name: name.trim(),
      role,
      status: 'ACTIVE',
    };
    if (ctx === 'muni') body.municipalityId = muniId;
    else body.contractorId = contractorId;
    if (phone) body.phone = phone;

    const r = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (r.ok) {
      onCreated({ username: username.trim(), tempPassword: password, role, name: name.trim() });
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j?.detail ?? j?.error ?? '등록 실패');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[560px] w-full max-h-[92vh] flex flex-col">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-black text-ink">신규 사용자 등록 (SUPER_ADMIN 전용)</h2>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">권한 (Role) *</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="w-full px-3 py-2 rounded border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
            >
              {CREATE_ROLE_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <div className="text-[0.625rem] text-slate-500 mt-1">
              {role === 'MUNI_ADMIN' && '※ 지자체관리자는 회사 소속이 없는 외부 감독자. 데이터는 조회만 가능.'}
              {role === 'CONTRACTOR_ADMIN' && '※ 위탁업체 대표 — 보통 위저드에서 자동 생성. 추가 발급 시 사용.'}
              {role === 'INTERNAL_ADMIN' && '※ 회사 내부 팀장 — 결재·배차·민원 배정.'}
              {role === 'WORKER' && '※ 모바일 앱 사용 근로자.'}
            </div>
          </div>

          {ctx === 'muni' && (
            <div>
              <div className="text-xs font-extrabold text-ink mb-1">관할 지자체 *</div>
              <input
                value={muniQuery}
                onChange={(e) => setMuniQuery(e.target.value)}
                placeholder="🔍 지자체 검색 (예: 용산구)"
                className="w-full px-3 py-2 rounded border-2 border-line text-sm focus:outline-none focus:border-accent mb-1.5"
              />
              <div className="border border-line rounded max-h-44 overflow-y-auto">
                {filteredMunis.length === 0 && <div className="px-3 py-3 text-center text-xs text-slate-500">{muniList.length === 0 ? '로딩 중…' : '결과 없음'}</div>}
                {filteredMunis.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMuniId(m.id)}
                    className={`w-full px-3 py-1.5 text-left text-sm border-b border-line last:border-b-0 transition ${
                      muniId === m.id ? 'bg-accent text-white font-extrabold' : 'hover:bg-slate-50'
                    }`}
                  >
                    {m.name}
                    <span className={`ml-2 text-[0.625rem] font-mono ${muniId === m.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {m.region ?? ''} · {m.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ctx === 'contractor' && (
            <div>
              <div className="text-xs font-extrabold text-ink mb-1">소속 회사 *</div>
              <input
                value={contractorQuery}
                onChange={(e) => setContractorQuery(e.target.value)}
                placeholder="🔍 회사 검색 (회사명 또는 지자체)"
                className="w-full px-3 py-2 rounded border-2 border-line text-sm focus:outline-none focus:border-accent mb-1.5"
              />
              <div className="border border-line rounded max-h-44 overflow-y-auto">
                {filteredContractors.length === 0 && <div className="px-3 py-3 text-center text-xs text-slate-500">{contractorList.length === 0 ? '로딩 중…' : '결과 없음'}</div>}
                {filteredContractors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setContractorId(c.id)}
                    className={`w-full px-3 py-1.5 text-left text-sm border-b border-line last:border-b-0 transition ${
                      contractorId === c.id ? 'bg-accent text-white font-extrabold' : 'hover:bg-slate-50'
                    }`}
                  >
                    {c.companyName}
                    <span className={`ml-2 text-[0.625rem] font-mono ${contractorId === c.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {c.municipalityName ?? ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-extrabold text-ink mb-1">이름 *</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="w-full px-3 py-2 rounded border-2 border-line text-sm focus:outline-none focus:border-accent" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">아이디 *</div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="muni-yongsan-01" className="w-full px-3 py-2 rounded border-2 border-line text-sm font-mono focus:outline-none focus:border-accent" />
            <UsernameLivenStatus username={username} onPick={setUsername} />
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">임시 비밀번호 (자동 생성)</div>
            <div className="flex gap-1.5">
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 px-3 py-2 rounded border-2 border-line text-sm font-mono focus:outline-none focus:border-accent" />
              <button type="button" onClick={() => setPassword(genTempPw())} className="px-3 rounded border border-line text-xs font-bold bg-slate-50 hover:bg-slate-100">🎲 재생성</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink mb-1">전화 (선택)</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              inputMode="numeric"
              maxLength={13}
              className="w-full px-3 py-2 rounded border-2 border-line text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">⚠ {error}</div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-3 py-1.5 rounded border border-line text-sm font-bold hover:bg-white disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={busy} className="px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '등록 중…' : '✓ 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 위탁업체 관리 (삭제/복구) ─────────── */

type ContractorRow = {
  id: string;
  companyName: string;
  businessNo: string;
  status: string;
  deletedAt: string | null;
  municipalityName: string | null;
  municipalityRegion: string | null;
};

export function ContractorTrashTab() {
  const [items, setItems] = useState<ContractorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'all' | 'active' | 'trash'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (view === 'all') p.set('includeDeleted', 'true');
    else if (view === 'trash') p.set('onlyDeleted', 'true');
    fetch(`/api/contractors?${p}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [view]);

  async function softDelete(c: ContractorRow) {
    if (!confirm(`'${c.companyName}' 위탁업체를 휴지통으로 이동합니다.\n\n• 30일 내 복구 가능\n• 30일 후 자동 영구 삭제\n• 모든 사용자/차량/민원 데이터는 그대로 보존됩니다.\n\n진행하시겠습니까?`)) return;
    setBusy(c.id);
    const r = await fetch(`/api/contractors/${c.id}`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) load();
    else alert('실패: ' + ((await r.json().catch(() => ({}))).detail ?? 'unknown'));
  }

  async function restore(c: ContractorRow) {
    if (!confirm(`'${c.companyName}' 위탁업체를 복구합니다.\n현재 상태(${c.status})는 그대로 유지되며, 필요하면 [회사정보] 탭에서 ACTIVE 로 전환하세요.`)) return;
    setBusy(c.id);
    const r = await fetch(`/api/contractors/${c.id}/restore`, { method: 'POST' });
    setBusy(null);
    if (r.ok) load();
    else alert('실패');
  }

  async function hardDelete(c: ContractorRow) {
    if (!confirm(`⚠ '${c.companyName}' 영구 삭제\n\n복구 불가. 연결된 사용자·차량·민원이 1건이라도 있으면 차단됩니다.\n진행하시겠습니까?`)) return;
    setBusy(c.id);
    const r = await fetch(`/api/contractors/${c.id}?hard=true`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) load();
    else alert('실패: ' + ((await r.json().catch(() => ({}))).detail ?? 'unknown'));
  }

  function daysLeft(deletedAt: string): number {
    const expire = new Date(deletedAt).getTime() + 30 * 24 * 3600 * 1000;
    return Math.max(0, Math.ceil((expire - Date.now()) / (24 * 3600 * 1000)));
  }

  return (
    <div className="space-y-3">
      <div className="bg-purple-50 border border-purple-300 rounded-md px-3 py-2 text-xs text-purple-900">
        <b>📝 위탁업체 삭제 정책 (§8 Q4=B)</b>
        <ul className="mt-1 ml-5 list-disc space-y-0.5">
          <li>[🗑 휴지통] = soft-delete: 30일 내 복구 가능, 데이터 보존</li>
          <li>30일 경과 후 자동 영구 삭제 (별도 cron 필요 — 추후)</li>
          <li>[⚠ 영구삭제] = hard-delete: FK 의존성 0 일 때만, 즉시 복구 불가</li>
        </ul>
      </div>

      <div className="flex gap-1.5">
        <ViewBtn active={view === 'all'} onClick={() => setView('all')}>전체</ViewBtn>
        <ViewBtn active={view === 'active'} onClick={() => setView('active')}>정상</ViewBtn>
        <ViewBtn active={view === 'trash'} onClick={() => setView('trash')}>🗑 휴지통</ViewBtn>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-100 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">회사명</th>
                <th className="px-2 py-2 text-left">사업자번호</th>
                <th className="px-2 py-2 text-left">지자체</th>
                <th className="px-2 py-2 text-left">상태</th>
                <th className="px-2 py-2 text-left">삭제일</th>
                <th className="px-2 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">로딩 중…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">결과 없음</td></tr>}
              {items.map((c) => {
                const isDeleted = !!c.deletedAt;
                return (
                  <tr key={c.id} className={isDeleted ? 'bg-rose-50' : ''}>
                    <td className="px-2 py-2 font-bold text-ink">{c.companyName}</td>
                    <td className="px-2 py-2 font-mono text-xs">{c.businessNo}</td>
                    <td className="px-2 py-2 text-xs">{c.municipalityName ?? '—'}</td>
                    <td className="px-2 py-2">
                      <span className={`text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded border ${
                        c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        c.status === 'EXPIRED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[0.6875rem]">
                      {c.deletedAt ? (
                        <span className="text-rose-700">
                          {c.deletedAt.slice(0, 10)} <span className="text-[0.625rem] text-rose-500">(D-{daysLeft(c.deletedAt)})</span>
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {!isDeleted && (
                        <button
                          disabled={busy === c.id}
                          onClick={() => softDelete(c)}
                          className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          🗑 휴지통
                        </button>
                      )}
                      {isDeleted && (
                        <>
                          <button
                            disabled={busy === c.id}
                            onClick={() => restore(c)}
                            className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 mr-1 disabled:opacity-50"
                          >
                            ↩ 복구
                          </button>
                          <button
                            disabled={busy === c.id}
                            onClick={() => hardDelete(c)}
                            className="px-2 py-1 rounded text-[0.6875rem] font-extrabold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50"
                          >
                            ⚠ 영구삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition ${
        active ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
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
