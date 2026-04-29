'use client';

// Design Ref: §5.1.1, §7.1 — 처리시설 마스터 탭 추가 + ALL_REPORTS에 f02 코드
import { useEffect, useMemo, useState } from 'react';
import { FacilitiesTab } from './facilities/_facilities-tab';
import { BottomSheet } from '@/components/BottomSheet';
import OnboardingWizardModal from './_onboarding-wizard';
import { PRESETS, type PresetKey } from '@/lib/permission-presets';
import { UsersGlobalTab, SystemStatsTab, AuditLogTab, OrgTreeTab } from './_phase2-tabs';

const ALL_SCREENS = [
  { code: 'dashboard',     label: '메인 대시보드' },
  { code: 'users',         label: '사용자관리' },
  { code: 'attendance',    label: '근태관리' },
  /* 'payroll' 인건비 정산은 Clean ERP add-on 모듈로 분리 — 옵션 적용 시 코드 부활 */
  { code: 'complaints',    label: '민원관리' },
  { code: 'safety',        label: '산업안전보건' },
  { code: 'health',        label: '건강기록카드' },
  { code: 'vehicles',      label: '차량관리' },
  { code: 'live-vehicles', label: '실시간 차량조회' },
  { code: 'performance',   label: '실적관리' },
  { code: 'reports',       label: '통계/보고서' },
  { code: 'bulky-waste',   label: '대형폐기물 설정' },
];
const ALL_REPORTS = [
  { code: 'attendance',  label: '근태 보고서' },
  { code: 'leave',       label: '휴가 보고서' },
  { code: 'complaints',  label: '민원 보고서' },
  { code: 'vehicles',    label: '차량 운행 보고서' },
  { code: 'waste',       label: '처리실적 보고서' },
  { code: 'intake',      label: '반입실적 보고서' },
  { code: 'safety',      label: '안전보건 보고서' },
  { code: 'hr',          label: '인사 보고서' },
  // Design Ref: §7.1 — F-02 RBAC. MUNI_ADMIN 접근은 이 코드의 allowedReports 포함 필수
  { code: 'f02',         label: 'F-02 일일 처리실적 일보' },
];

type Muni = {
  id: string; name: string; code: string; status: string; contractorCount: number;
  policy: {
    allowedScreens: string[]; allowedReports: string[];
    exportEnabled: boolean; bulkExportEnabled: boolean; note: string | null;
    updatedAt: string;
  } | null;
};

type Aggregate = {
  municipality: { id: string; name: string; code: string };
  range: { from: string; to: string };
  contractors: Array<{
    id: string; companyName: string; businessNo: string; status: string;
    users: number; attendance: number; leaves: number; leavesApproved: number;
    complaints: number; vehicles: number; vehicleLogs: number; vehicleWasteKg: number;
    waste: number; intake: number; safety: number;
  }>;
  summary: {
    contractors: number; totalUsers: number; totalAttendance: number; totalLeaves: number;
    totalComplaints: number; totalVehicles: number; totalVehicleLogs: number;
    totalWasteTon: number; totalIntakeTon: number; totalSafety: number;
  } | null;
};

type SuperTab = 'munis' | 'policies' | 'aggregate' | 'gis' | 'company' | 'facilities' | 'users-global' | 'system' | 'audit' | 'org-tree';

export default function SuperAdminClient() {
  const [tab, setTab] = useState<SuperTab>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'facilities') return 'facilities';
    }
    return 'munis';
  });
  /* P1-3 신규 위탁업체 개설 마법사 (5단계) */
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-extrabold text-ink">슈퍼관리자 콘솔</h2>
        <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-purple-600 text-white">SUPER_ADMIN ONLY</span>
        <a
          href="/super-admin/permission-print"
          target="_blank"
          rel="noopener"
          className="ml-auto px-3 py-2 rounded-lg border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-extrabold transition"
          title="권한 매트릭스 인쇄용 페이지 (Ctrl+P → PDF)"
        >
          🖨 권한 매트릭스 인쇄
        </a>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md active:scale-95 transition"
          title="회사 정보 + 지자체 + 권한 + 관리자 계정을 5단계로 한 번에 개설"
        >
          ＋ 신규 위탁업체 개설
        </button>
      </div>

      {wizardOpen && (
        <OnboardingWizardModal
          onClose={() => setWizardOpen(false)}
          onCreated={() => { /* 다음 진입 시 탭들이 fresh fetch */ }}
        />
      )}

      <div className="flex gap-1 border-b-2 border-line overflow-x-auto">
        <Tab active={tab === 'munis'} onClick={() => setTab('munis')}>지자체 관리</Tab>
        <Tab active={tab === 'policies'} onClick={() => setTab('policies')}>지자체 권한 매트릭스</Tab>
        <Tab active={tab === 'aggregate'} onClick={() => setTab('aggregate')}>관할 거래처 일괄 조회/출력</Tab>
        <Tab active={tab === 'company'} onClick={() => setTab('company')}>회사정보·차고지</Tab>
        <Tab active={tab === 'gis'} onClick={() => setTab('gis')}>GIS API 설정</Tab>
        <Tab active={tab === 'facilities'} onClick={() => setTab('facilities')}>처리시설 마스터</Tab>
        {/* Phase 2 신규 탭 4종 */}
        <Tab active={tab === 'users-global'} onClick={() => setTab('users-global')}>👥 사용자 (전체)</Tab>
        <Tab active={tab === 'system'} onClick={() => setTab('system')}>📊 시스템 모니터링</Tab>
        <Tab active={tab === 'audit'} onClick={() => setTab('audit')}>📜 감사 로그</Tab>
        <Tab active={tab === 'org-tree'} onClick={() => setTab('org-tree')}>🌲 조직 트리</Tab>
      </div>

      {tab === 'munis' && <MunicipalitiesTab />}
      {tab === 'policies' && <PoliciesTab />}
      {tab === 'aggregate' && <AggregateTab />}
      {tab === 'company' && <CompanyInfoTab />}
      {tab === 'gis' && <GisConfigTab />}
      {tab === 'facilities' && <FacilitiesTab />}
      {tab === 'users-global' && <UsersGlobalTab />}
      {tab === 'system' && <SystemStatsTab />}
      {tab === 'audit' && <AuditLogTab />}
      {tab === 'org-tree' && <OrgTreeTab />}
    </div>
  );
}

/* ─────────────  탭 0: 전국 지자체 관리 (CRUD + 검색·필터)  ───────────── */

type MuniRow = {
  id: string;
  name: string;
  code: string;
  region: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  contractorCount: number;
  adminCount: number;
};

function MunicipalitiesTab() {
  const [items, setItems] = useState<MuniRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<MuniRow | null>(null);
  const [creating, setCreating] = useState(false);
  /* P1-3 — 광역-기초 아코디언 뷰 */
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  /* 광역별 그룹핑 — 검색·필터 결과를 region 기준으로 묶음 */
  const grouped = useMemo(() => {
    const map = new Map<string, MuniRow[]>();
    for (const m of items) {
      const key = m.region ?? '미분류';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    /* 광역 정렬 — regions 배열 순서 우선, 그 외는 가나다 */
    const orderedKeys = [...map.keys()].sort((a, b) => {
      const ai = regions.indexOf(a);
      const bi = regions.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, 'ko');
    });
    return orderedKeys.map((key) => {
      const list = map.get(key)!.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const active = list.filter((m) => m.status === 'ACTIVE' && m.contractorCount > 0).length;
      const dormant = list.filter((m) => m.contractorCount === 0).length;
      const totalContractors = list.reduce((s, m) => s + m.contractorCount, 0);
      return { region: key, list, active, dormant, totalContractors };
    });
  }, [items, regions]);

  function toggleRegion(r: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function expandAll() { setExpandedRegions(new Set(grouped.map((g) => g.region))); }
  function collapseAll() { setExpandedRegions(new Set()); }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (region) params.set('region', region);
    if (status) params.set('status', status);
    params.set('limit', '500');
    const r = await fetch(`/api/super-admin/municipalities?${params}`);
    const d = await r.json();
    setItems(d.items ?? []);
    setRegions(d.regions ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function toggleStatus(m: MuniRow) {
    const next = m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`${m.name}을(를) ${next === 'ACTIVE' ? '활성화' : '비활성화'} 하시겠습니까?`)) return;
    const r = await fetch(`/api/super-admin/municipalities/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) load();
    else alert('실패: ' + (await r.json().catch(() => ({}))).error);
  }

  async function remove(m: MuniRow) {
    if (m.contractorCount > 0) {
      alert(`산하 위탁업체 ${m.contractorCount}곳이 있어 삭제할 수 없습니다. 비활성화만 가능합니다.`);
      return;
    }
    if (!confirm(`${m.name} (${m.code})을(를) 영구 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/super-admin/municipalities/${m.id}`, { method: 'DELETE' });
    if (r.ok) load();
    else alert('실패: ' + (await r.json().catch(() => ({}))).error);
  }

  /* 위탁업체 운영 기준으로 실제 활성 카운트 — 위탁 없는 ACTIVE는 휴면 취급 */
  const activeCount = items.filter((m) => m.status === 'ACTIVE' && m.contractorCount > 0).length;
  const withContractor = items.filter((m) => m.contractorCount > 0).length;
  const dormantCount = items.filter((m) => m.contractorCount === 0).length;

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MuniStat label="총 지자체" value={total} />
        <MuniStat label="활성 (운영중)" value={activeCount} accent="text-emerald-700" />
        <MuniStat label="비활성 (휴면)" value={dormantCount} accent="text-slate-600" />
        <MuniStat label="광역단체" value={regions.length} accent="text-purple-700" />
      </div>

      {/* 검색·필터 */}
      <div className="bg-surface-soft border border-line rounded-lg p-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="이름·코드 검색"
          className="px-3 py-1.5 rounded-md border-2 border-line text-sm font-semibold w-44 focus:outline-none focus:border-accent"
        />
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="px-3 py-1.5 rounded-md border-2 border-line text-sm font-semibold">
          <option value="">전체 광역</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-md border-2 border-line text-sm font-semibold">
          <option value="">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="PENDING">대기</option>
          <option value="SUSPENDED">비활성</option>
        </select>
        <button onClick={load} className="px-3 py-1.5 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800">
          🔍 조회
        </button>

        {/* P1-3 — 광역-기초 아코디언 vs 테이블 토글 */}
        <div className="flex items-center gap-1 ml-2 border border-line rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 text-xs font-extrabold ${viewMode === 'grouped' ? 'bg-purple-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            aria-pressed={viewMode === 'grouped'}
          >
            📂 광역 그룹
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-extrabold ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            aria-pressed={viewMode === 'table'}
          >
            📋 테이블
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm('위탁업체 운영 여부 기준으로 모든 지자체 상태를 DB에 일괄 반영합니다.\n• 위탁 없음 → 비활성\n• 위탁 있음 → 활성\n진행하시겠습니까?')) return;
              const r = await fetch('/api/super-admin/municipalities/sync-status', { method: 'POST' });
              if (r.ok) {
                const d = await r.json();
                alert(`동기화 완료\n• 비활성 전환: ${d.suspended}건\n• 활성 전환: ${d.activated}건`);
                load();
              } else {
                alert('실패: ' + (await r.json().catch(() => ({}))).error);
              }
            }}
            className="px-3 py-1.5 rounded-md bg-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-300 border border-slate-300"
            title="위탁업체 운영 기준으로 모든 지자체 상태를 DB에 일괄 반영"
          >
            🔄 DB 동기화
          </button>
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700"
          >
            + 지자체 신규 등록
          </button>
        </div>
      </div>

      {/* 본문 — 모드별 분기 */}
      {viewMode === 'table' ? (
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-surface-soft border-b-2 border-line">
              <tr className="text-left">
                <MTh>광역</MTh>
                <MTh>지자체명</MTh>
                <MTh>행정코드</MTh>
                <MTh>상태</MTh>
                <MTh align="right">위탁업체</MTh>
                <MTh align="right">관리자</MTh>
                <MTh align="right">작업</MTh>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-8 text-slate-700 font-bold">로딩 중…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-700 font-bold">조건에 맞는 지자체 없음</td></tr>}
              {!loading && items.map((m) => (
                <tr key={m.id} className="border-b border-line hover:bg-surface-soft">
                  <MTd className="text-[0.6875rem] font-mono font-bold text-ink-muted">{m.region ?? '—'}</MTd>
                  <MTd className="font-extrabold text-ink">{m.name}</MTd>
                  <MTd className="font-mono text-[0.6875rem] text-ink-muted">{m.code}</MTd>
                  <MTd>
                    <span className="inline-flex items-center gap-1">
                      <MuniStatusBadge status={m.status} />
                      {m.status === 'ACTIVE' && m.contractorCount === 0 && <DormantBadge />}
                    </span>
                  </MTd>
                  <MTd align="right">
                    {m.contractorCount > 0
                      ? <span className="font-mono font-bold text-info">{m.contractorCount}</span>
                      : <span className="text-ink-faint">0</span>}
                  </MTd>
                  <MTd align="right">
                    {m.adminCount > 0
                      ? <span className="font-mono font-bold text-purple-700">{m.adminCount}</span>
                      : <span className="text-ink-faint">0</span>}
                  </MTd>
                  <MTd align="right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setEditing(m)} className="text-[0.6875rem] font-extrabold px-2 py-1 rounded border border-line hover:bg-surface-soft">편집</button>
                      <button onClick={() => toggleStatus(m)} className={`text-[0.6875rem] font-extrabold px-2 py-1 rounded ${m.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                        {m.status === 'ACTIVE' ? '비활성화' : '활성화'}
                      </button>
                      <button onClick={() => remove(m)} className="text-[0.6875rem] font-extrabold px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">삭제</button>
                    </div>
                  </MTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* 광역-기초 아코디언 */
        <div className="space-y-2">
          {/* 광역 그룹 컨트롤 */}
          <div className="flex items-center gap-2 text-xs">
            <button onClick={expandAll} className="px-2 py-1 rounded border border-line bg-white font-bold hover:bg-slate-50">
              ▼ 모두 펼치기
            </button>
            <button onClick={collapseAll} className="px-2 py-1 rounded border border-line bg-white font-bold hover:bg-slate-50">
              ▶ 모두 접기
            </button>
            <span className="text-slate-700 font-bold ml-2">{grouped.length} 광역 · {items.length} 지자체</span>
          </div>

          {loading && <div className="text-center py-8 text-slate-700 font-bold">로딩 중…</div>}
          {!loading && grouped.length === 0 && <div className="text-center py-8 text-slate-700 font-bold">조건에 맞는 지자체 없음</div>}

          {!loading && grouped.map((g) => {
            const open = expandedRegions.has(g.region);
            return (
              <div key={g.region} className="bg-surface border border-line rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleRegion(g.region)}
                  aria-expanded={open}
                  aria-controls={`region-panel-${g.region}`}
                  className="w-full px-4 py-3 flex items-center gap-3 bg-surface-soft hover:bg-slate-100 transition text-left"
                >
                  <span className="text-purple-700 text-sm font-mono font-extrabold w-4">{open ? '▼' : '▶'}</span>
                  <span className="font-black text-base text-ink flex-1">{g.region}</span>
                  <span className="text-[0.6875rem] font-mono font-bold text-emerald-700">활성 {g.active}</span>
                  <span className="text-[0.6875rem] font-mono font-bold text-slate-700">휴면 {g.dormant}</span>
                  <span className="text-[0.6875rem] font-mono font-bold text-info">위탁 {g.totalContractors}</span>
                  <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{g.list.length}</span>
                </button>
                {open && (
                  <div id={`region-panel-${g.region}`} className="border-t border-line">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-alt border-b border-line">
                        <tr className="text-left">
                          <MTh>지자체명</MTh>
                          <MTh>행정코드</MTh>
                          <MTh>상태</MTh>
                          <MTh align="right">위탁업체</MTh>
                          <MTh align="right">관리자</MTh>
                          <MTh align="right">작업</MTh>
                        </tr>
                      </thead>
                      <tbody>
                        {g.list.map((m) => (
                          <tr key={m.id} className="border-b border-line last:border-b-0 hover:bg-surface-soft">
                            <MTd className="font-extrabold text-ink">{m.name}</MTd>
                            <MTd className="font-mono text-[0.6875rem] text-ink-muted">{m.code}</MTd>
                            <MTd>
                              <span className="inline-flex items-center gap-1">
                                <MuniStatusBadge status={m.status} />
                                {m.status === 'ACTIVE' && m.contractorCount === 0 && <DormantBadge />}
                              </span>
                            </MTd>
                            <MTd align="right">
                              {m.contractorCount > 0
                                ? <span className="font-mono font-bold text-info">{m.contractorCount}</span>
                                : <span className="text-ink-faint">0</span>}
                            </MTd>
                            <MTd align="right">
                              {m.adminCount > 0
                                ? <span className="font-mono font-bold text-purple-700">{m.adminCount}</span>
                                : <span className="text-ink-faint">0</span>}
                            </MTd>
                            <MTd align="right">
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => setEditing(m)} className="text-[0.6875rem] font-extrabold px-2 py-1 rounded border border-line hover:bg-surface-soft">편집</button>
                                <button onClick={() => toggleStatus(m)} className={`text-[0.6875rem] font-extrabold px-2 py-1 rounded ${m.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                                  {m.status === 'ACTIVE' ? '비활성화' : '활성화'}
                                </button>
                                <button onClick={() => remove(m)} className="text-[0.6875rem] font-extrabold px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">삭제</button>
                              </div>
                            </MTd>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <MuniEditModal
          muni={editing}
          regions={regions}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function MuniEditModal({
  muni, regions, onClose, onSaved,
}: {
  muni: MuniRow | null;
  regions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !muni;
  const [name, setName] = useState(muni?.name ?? '');
  const [code, setCode] = useState(muni?.code ?? '');
  const [region, setRegion] = useState(muni?.region ?? '');
  const [status, setStatus] = useState<'PENDING' | 'ACTIVE' | 'SUSPENDED'>(muni?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* 자동완성 — 신규 등록 모드에서만 동작 */
  const [suggestions, setSuggestions] = useState<MuniRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedExisting, setMatchedExisting] = useState<MuniRow | null>(null);
  const [searching, setSearching] = useState(false);

  /* 디바운스 검색 */
  useEffect(() => {
    if (!isNew) return;
    if (matchedExisting && matchedExisting.name === name) return;  // 이미 선택됨
    const q = name.trim();
    if (q.length < 1) { setSuggestions([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/super-admin/municipalities/lookup?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setSuggestions(d.items ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [name, isNew]);

  /* 자동완성 항목 선택 → 모든 필드 자동 채움 + 활성화 모드 전환 */
  function selectSuggestion(s: MuniRow) {
    setName(s.name);
    setCode(s.code);
    setRegion(s.region ?? '');
    setStatus(s.status);
    setMatchedExisting(s);
    setSuggestions([]);
    setShowSuggestions(false);
    setErr(null);
  }

  function clearSelection() {
    setName('');
    setCode('');
    setRegion('');
    setStatus('ACTIVE');
    setMatchedExisting(null);
    setSuggestions([]);
  }

  async function save() {
    if (!name.trim()) { setErr('지자체명을 입력하세요.'); return; }
    setSaving(true); setErr(null);

    /* 자동완성으로 기존 지자체 선택 시 → PATCH로 활성화/상태 변경 */
    if (isNew && matchedExisting) {
      const r = await fetch(`/api/super-admin/municipalities/${matchedExisting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, region: region.trim() || null }),
      });
      setSaving(false);
      if (r.ok) onSaved();
      else {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? '저장 실패');
      }
      return;
    }

    if (isNew && !code.trim()) { setErr('행정코드를 입력하세요. (자동완성에서 선택하면 자동 입력됩니다)'); setSaving(false); return; }
    const url = isNew ? '/api/super-admin/municipalities' : `/api/super-admin/municipalities/${muni!.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    const body = isNew
      ? { name: name.trim(), code: code.trim(), region: region.trim() || undefined, status }
      : { name: name.trim(), region: region.trim() || null, status };
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (r.ok) onSaved();
    else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error === 'code_already_exists' ? '이미 존재하는 행정코드입니다. (자동완성에서 선택하면 활성화됩니다)' : (j.error ?? '저장 실패'));
    }
  }

  /* 신규 등록 + 자동완성 매칭 = "활성화 모드" */
  const isActivationMode = isNew && !!matchedExisting;
  const headerTitle = !isNew
    ? `${muni!.name} 편집`
    : isActivationMode
      ? `${matchedExisting!.name} 활성화`
      : '지자체 신규 등록';

  return (
    <BottomSheet open={true} onClose={onClose} title={headerTitle} desktopMaxWidth="520px">
      {isActivationMode && (
        <div className="px-5 pt-3 -mb-1">
          <span className="text-[0.625rem] font-mono font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300">
            기존 데이터
          </span>
        </div>
      )}

      {isNew && (
          <div className="px-5 pt-4 pb-2 text-[0.6875rem] font-bold text-ink-muted">
            💡 지자체명을 입력하면 행정안전부 표준 지자체 267개에서 자동으로 검색됩니다. 선택하면 행정코드·광역이 자동 입력됩니다.
          </div>
        )}

        <div className="p-5 space-y-3">
          <Field label="지자체명 *">
            <div className="relative">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  /* 사용자가 다시 타이핑하면 매칭 상태 해제 */
                  if (matchedExisting && e.target.value !== matchedExisting.name) {
                    setMatchedExisting(null);
                    setCode('');
                  }
                }}
                onFocus={() => isNew && name && setShowSuggestions(true)}
                placeholder={isNew ? '예: 강남, 서울특별시 강남구, 11680' : ''}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
              />
              {matchedExisting && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.6875rem] font-bold text-slate-600 hover:text-red-600"
                >
                  ✕ 선택 해제
                </button>
              )}

              {/* 자동완성 드롭다운 */}
              {isNew && showSuggestions && suggestions.length > 0 && !matchedExisting && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface border-2 border-accent rounded-md shadow-modal max-h-[280px] overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSuggestion(s)}
                      className="w-full px-3 py-2 text-left hover:bg-accent-soft border-b border-line last:border-b-0 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold text-ink truncate">
                          <span className="text-[0.6875rem] font-mono font-bold text-ink-muted mr-2">{s.region ?? '—'}</span>
                          {s.name}
                        </div>
                        <div className="text-[0.6875rem] font-mono text-ink-muted mt-0.5">
                          코드: {s.code} {s.contractorCount > 0 && `· 위탁업체 ${s.contractorCount}곳`}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1">
                        <MuniStatusBadge status={s.status} />
                        {s.status === 'ACTIVE' && s.contractorCount === 0 && <DormantBadge />}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {isNew && searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem] font-mono text-accent animate-pulse">검색 중…</div>
              )}
            </div>
          </Field>

          {/* 활성화 모드 안내 */}
          {isActivationMode && (
            <div className="px-3 py-2 rounded-md bg-purple-50 border border-purple-300 text-[0.6875rem] font-bold text-purple-900">
              ℹ️ <strong>기존 등록된 지자체</strong>입니다 (현재 상태: <MuniStatusBadge status={matchedExisting!.status} />).
              상태와 광역단체만 수정할 수 있으며, 저장하면 즉시 반영됩니다.
              {matchedExisting!.contractorCount > 0 && (
                <span className="block mt-1">⚠️ 산하 위탁업체 {matchedExisting!.contractorCount}곳이 운영 중입니다.</span>
              )}
            </div>
          )}

          <Field label={`행정코드 ${isNew ? (matchedExisting ? '(자동 입력)' : '*') : '(변경 불가)'}`}>
            <input
              value={code}
              disabled={!isNew || !!matchedExisting}
              onChange={(e) => setCode(e.target.value)}
              placeholder={isNew && !matchedExisting ? '5자리 숫자 (예: 11680)' : ''}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-semibold disabled:bg-surface-soft disabled:text-ink-muted focus:outline-none focus:border-accent"
            />
          </Field>
          <Field label="광역단체">
            <input
              list="regions-list"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 서울특별시"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
            />
            <datalist id="regions-list">
              {regions.map((r) => <option key={r} value={r} />)}
            </datalist>
          </Field>
          <Field label="상태">
            <select value={status} onChange={(e) => setStatus(e.target.value as 'PENDING' | 'ACTIVE' | 'SUSPENDED')} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold">
              <option value="ACTIVE">활성</option>
              <option value="PENDING">대기</option>
              <option value="SUSPENDED">비활성</option>
            </select>
          </Field>
          {err && <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">{err}</div>}
        </div>
      <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface min-h-[44px]">취소</button>
        <button onClick={save} disabled={saving} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50 min-h-[44px]">
          {saving ? '저장 중…' : isActivationMode ? '활성화/저장' : isNew ? '등록' : '저장'}
        </button>
      </footer>
    </BottomSheet>
  );
}

function MuniStatusBadge({ status }: { status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' }) {
  const map = {
    ACTIVE:    { label: '활성',   cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    PENDING:   { label: '대기',   cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    SUSPENDED: { label: '비활성', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  } as const;
  const m = map[status];
  return <span className={`text-[0.625rem] font-mono font-extrabold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
}

/* 휴면 표시 — DB status는 ACTIVE이지만 산하 위탁업체가 0인 상태 (운영 미시작) */
function DormantBadge() {
  return <span className="text-[0.625rem] font-mono font-extrabold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-300">휴면</span>;
}

function MuniStat({ label, value, accent = 'text-ink' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-4 py-3">
      <div className="text-[0.625rem] font-mono font-bold text-ink-muted tracking-widest">{label}</div>
      <div className={`text-2xl font-mono font-black mt-1 ${accent}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function MTh({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return <th className={`px-3 py-2 text-[0.625rem] font-mono font-extrabold text-ink-muted tracking-widest ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>{children}</th>;
}

function MTd({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return <td className={`px-3 py-2 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}>{children}</td>;
}

function CompanyInfoTab() {
  /* SUPER_ADMIN 은 contractorId=null. 지자체 → 위탁업체 계층 picker. */
  const [munis, setMunis] = useState<{ id: string; name: string; region: string | null }[]>([]);
  const [selectedMuniId, setSelectedMuniId] = useState<string>('');
  const [contractorOpts, setContractorOpts] = useState<{ id: string; companyName: string; municipalityId: string | null }[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [c, setC] = useState<{ id: string; companyName: string; businessNo: string; municipalityName: string; ceoName: string | null; phoneMain: string | null; emailMain: string | null; garageAddress: string | null; garageLat: number | null; garageLng: number | null; status: string; contractStart?: string | null; contractEnd?: string | null } | null>(null);
  const [form, setForm] = useState({ ceoName: '', phoneMain: '', emailMain: '', garageAddress: '', garageLat: '', garageLng: '' });
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  /* 지자체 목록 로드 (1회) */
  useEffect(() => {
    fetch('/api/super-admin/municipalities?limit=500&status=ACTIVE')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const opts = (j.items ?? []).map((m: { id: string; name: string; region: string | null }) => ({
          id: m.id, name: m.name, region: m.region,
        }));
        setMunis(opts);
        if (opts.length > 0 && !selectedMuniId) setSelectedMuniId(opts[0].id);
      })
      .catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* 위탁업체 목록 로드 — 지자체 선택 시 그 지자체 산하만 */
  function loadContractors(autoSelectId?: string) {
    if (!selectedMuniId) { setContractorOpts([]); setSelectedId(''); return; }
    fetch(`/api/contractors?municipalityId=${selectedMuniId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const opts = (j.items ?? []).map((x: { id: string; companyName: string; municipalityId: string | null }) => ({
          id: x.id, companyName: x.companyName, municipalityId: x.municipalityId,
        }));
        setContractorOpts(opts);
        if (autoSelectId) setSelectedId(autoSelectId);
        else if (opts.length > 0) setSelectedId(opts[0].id);
        else setSelectedId('');
      })
      .catch(() => undefined);
  }
  useEffect(() => { loadContractors(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedMuniId]);

  function load() {
    if (!selectedId) return;
    fetch(`/api/contractor/info?contractorId=${selectedId}`).then((r) => r.json()).then((d) => {
      const x = d.contractor;
      setC(x);
      if (x) setForm({
        ceoName: x.ceoName ?? '',
        phoneMain: x.phoneMain ?? '',
        emailMain: x.emailMain ?? '',
        garageAddress: x.garageAddress ?? '',
        garageLat: x.garageLat != null ? String(x.garageLat) : '',
        garageLng: x.garageLng != null ? String(x.garageLng) : '',
      });
    });
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId]);

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      contractorId: selectedId,
      ceoName: form.ceoName || null,
      phoneMain: form.phoneMain || null,
      emailMain: form.emailMain || null,
      garageAddress: form.garageAddress || null,
      garageLat: form.garageLat ? Number(form.garageLat) : null,
      garageLng: form.garageLng ? Number(form.garageLng) : null,
    };
    const res = await fetch('/api/contractor/info', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { alert('저장됨'); load(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  /* OSM Nominatim 지오코딩 — 주소 → 좌표 (무료, 키 불필요) */
  async function geocode() {
    if (!form.garageAddress.trim()) { alert('차고지 주소를 입력하세요.'); return; }
    setGeoBusy(true);
    try {
      const q = encodeURIComponent(form.garageAddress);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=ko`);
      const arr = await r.json();
      if (arr?.[0]) {
        setForm({ ...form, garageLat: arr[0].lat, garageLng: arr[0].lon });
        alert(`좌표 변환됨: ${arr[0].lat}, ${arr[0].lon}\n${arr[0].display_name}`);
      } else {
        alert('주소를 찾을 수 없습니다. 좌표를 직접 입력하세요.');
      }
    } catch {
      alert('지오코딩 서버 오류 — 좌표를 직접 입력하세요.');
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5 max-w-[720px] space-y-4">
      {/* 1단계 — 지자체 picker (SUPER_ADMIN 계층 진입) */}
      <div className="flex items-center gap-2 pb-2 border-b border-line">
        <label htmlFor="company-muni-picker" className="text-xs font-extrabold text-slate-700 whitespace-nowrap">지자체</label>
        <select
          id="company-muni-picker"
          value={selectedMuniId}
          onChange={(e) => setSelectedMuniId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-purple-500 min-h-[40px]"
        >
          {munis.length === 0 && <option value="">— 지자체 없음 —</option>}
          {munis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.region ? `[${m.region}] ` : ''}{m.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2단계 — 위탁업체 picker + 신규 등록 (선택된 지자체 산하만) */}
      <div className="flex items-center gap-2 pb-3 border-b border-line">
        <label htmlFor="contractor-picker" className="text-xs font-extrabold text-slate-700 whitespace-nowrap">위탁업체</label>
        <select
          id="contractor-picker"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={!selectedMuniId || contractorOpts.length === 0}
          className="flex-1 px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-purple-500 disabled:bg-slate-100 min-h-[40px]"
        >
          {contractorOpts.length === 0 && <option value="">— 산하 위탁업체 없음 —</option>}
          {contractorOpts.map((o) => (
            <option key={o.id} value={o.id}>{o.companyName}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!selectedMuniId}
          className="px-3 py-2 rounded-md bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 active:scale-95 disabled:opacity-50"
        >
          + 신규 등록
        </button>
      </div>

      {showCreate && (
        <ContractorCreateModal
          defaultMunicipalityId={selectedMuniId}
          onClose={() => setShowCreate(false)}
          onCreated={(newId) => {
            setShowCreate(false);
            loadContractors(newId);
          }}
        />
      )}

      {!c && (
        <div className="text-center py-8 text-slate-700 font-bold">
          {selectedId ? '회사 정보 로딩 중…' : '위탁업체를 선택해 주세요.'}
        </div>
      )}

      {c && (<>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-extrabold text-ink">{c.companyName}</h3>
        <span className="text-[0.625rem] font-mono font-bold text-slate-600">{c.businessNo}</span>
        <span className="text-[0.625rem] font-mono font-bold text-slate-600">관할: {c.municipalityName}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="대표자">
          <input value={form.ceoName} onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold" />
        </Field>
        <Field label="대표 전화">
          <input value={form.phoneMain} onChange={(e) => setForm({ ...form, phoneMain: e.target.value })} placeholder="02-1234-5678"
            className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </Field>
        <Field label="이메일">
          <input value={form.emailMain} onChange={(e) => setForm({ ...form, emailMain: e.target.value })} placeholder="info@company.co.kr"
            className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
        </Field>
      </div>

      <div className="border-t-2 border-purple-300 pt-4">
        <div className="text-sm font-extrabold text-purple-900 mb-2">🏁 차고지 (추천경로 출발/종료점)</div>
        <div className="space-y-2">
          <Field label="차고지 주소">
            <div className="flex gap-1">
              <input value={form.garageAddress} onChange={(e) => setForm({ ...form, garageAddress: e.target.value })}
                placeholder="서울시 강남구 역삼동 123-45 차고지"
                className="flex-1 px-3 py-1.5 rounded border border-line text-sm" />
              <button onClick={geocode} disabled={geoBusy || !form.garageAddress}
                className="px-3 py-1.5 rounded text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {geoBusy ? '변환…' : '📍 좌표 변환'}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="위도 (lat)">
              <input value={form.garageLat} onChange={(e) => setForm({ ...form, garageLat: e.target.value })}
                placeholder="37.4979" className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
            </Field>
            <Field label="경도 (lng)">
              <input value={form.garageLng} onChange={(e) => setForm({ ...form, garageLng: e.target.value })}
                placeholder="127.0473" className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
            </Field>
          </div>
          <div className="text-[0.625rem] font-mono text-slate-600 bg-slate-50 rounded p-2">
            💡 차고지 좌표는 <code>/live-vehicles → 추천경로 계산</code>의 출발/종료점으로 자동 사용됩니다.<br />
            📍 좌표 변환 버튼: OpenStreetMap Nominatim (무료) 사용. 변환 후 정확도 확인 권장.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            disabled={!c}
            className="px-4 py-1.5 rounded text-sm font-extrabold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            ✏ 업체 기본정보 수정
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!c) return;
              const ok = confirm(
                `'${c.companyName}'을(를) 영구 삭제합니다.\n` +
                  `연결된 사용자/차량/실적/민원이 있으면 삭제 불가 (409 차단).\n` +
                  `정말 삭제하시겠습니까?`
              );
              if (!ok) return;
              const res = await fetch(`/api/contractors/${selectedId}`, { method: 'DELETE' });
              const j = await res.json().catch(() => ({}));
              if (res.ok) {
                alert('삭제 완료');
                setSelectedId('');
                setC(null);
                loadContractors();
              } else if (res.status === 409) {
                alert(`삭제 차단:\n${j.detail ?? '연결된 데이터가 있습니다'}`);
              } else {
                alert(`실패: ${j.error ?? `HTTP ${res.status}`}`);
              }
            }}
            disabled={!c}
            className="px-4 py-1.5 rounded text-sm font-extrabold bg-danger text-white hover:bg-red-800 disabled:opacity-50"
          >
            🗑 업체 삭제
          </button>
        </div>
        <button disabled={saving} onClick={save}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
          {saving ? '저장 중…' : '회사정보·차고지 저장'}
        </button>
      </div>

      {showEdit && c && (
        <ContractorEditModal
          contractor={c}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); loadContractors(selectedId); }}
        />
      )}
      </>)}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-3 text-[0.9375rem] font-black tracking-tight border-b-[3px] -mb-0.5 transition ${
        active ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-slate-700 hover:text-ink hover:bg-slate-100'
      }`}>{children}</button>
  );
}

/* ─────────────  탭 1: 지자체 권한 매트릭스  ───────────── */
function PoliciesTab() {
  const [munis, setMunis] = useState<Muni[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Muni | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/super-admin/muni-policies')
      .then((r) => r.json())
      .then((d) => setMunis(d.items ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      {loading && <div className="text-center py-10 text-slate-500">로딩 중…</div>}
      {!loading && munis.length === 0 && (
        <div className="text-center py-10 text-slate-500">등록된 지자체가 없습니다.</div>
      )}
      {!loading && munis.map((m) => (
        <div key={m.id} className="bg-surface border-2 border-line rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 flex items-center gap-3">
            <span className="font-extrabold text-ink text-base">{m.name}</span>
            <span className="text-[0.625rem] font-mono font-bold text-slate-600">{m.code}</span>
            <span className="text-[0.625rem] font-mono font-bold text-slate-600">관할 거래처 {m.contractorCount}</span>
            <span className={`ml-auto text-[0.625rem] font-extrabold px-2 py-0.5 rounded border-2 ${
              m.policy ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-amber-100 text-amber-800 border-amber-500'
            }`}>
              {m.policy ? '✓ 정책 설정됨' : '⚠ 미설정 (기본값 적용)'}
            </span>
            <button onClick={() => setEditing(m)}
              className="px-3 py-1 rounded text-[0.6875rem] font-extrabold bg-purple-600 text-white hover:bg-purple-700">
              {m.policy ? '권한 수정' : '+ 권한 설정'}
            </button>
          </div>
          {m.policy && (
            <div className="p-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-extrabold text-slate-600 mb-1">허용 화면 ({m.policy.allowedScreens.length}/{ALL_SCREENS.length})</div>
                <div className="flex flex-wrap gap-1">
                  {m.policy.allowedScreens.map((s) => {
                    const def = ALL_SCREENS.find((x) => x.code === s);
                    return <span key={s} className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">{def?.label ?? s}</span>;
                  })}
                </div>
              </div>
              <div>
                <div className="font-extrabold text-slate-600 mb-1">허용 보고서 ({m.policy.allowedReports.length}/{ALL_REPORTS.length})</div>
                <div className="flex flex-wrap gap-1">
                  {m.policy.allowedReports.map((s) => {
                    const def = ALL_REPORTS.find((x) => x.code === s);
                    return <span key={s} className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">{def?.label ?? s}</span>;
                  })}
                </div>
              </div>
              <div className="col-span-2 flex gap-3 mt-1">
                <span className={`text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded border ${m.policy.exportEnabled ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-200 text-slate-600 border-slate-400'}`}>
                  {m.policy.exportEnabled ? '✓ 출력 가능' : '✗ 출력 불가'}
                </span>
                <span className={`text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded border ${m.policy.bulkExportEnabled ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-200 text-slate-600 border-slate-400'}`}>
                  {m.policy.bulkExportEnabled ? '✓ 일괄 출력' : '✗ 일괄 출력 불가'}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <PolicyEditModal muni={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function PolicyEditModal({ muni, onClose, onSaved }: { muni: Muni; onClose: () => void; onSaved: () => void }) {
  const [screens, setScreens] = useState<Set<string>>(new Set(muni.policy?.allowedScreens ?? ['dashboard', 'complaints', 'reports']));
  const [reports, setReports] = useState<Set<string>>(new Set(muni.policy?.allowedReports ?? ALL_REPORTS.map((r) => r.code)));
  const [exportEnabled, setExportEnabled] = useState(muni.policy?.exportEnabled ?? true);
  const [bulkExportEnabled, setBulkExportEnabled] = useState(muni.policy?.bulkExportEnabled ?? false);
  const [note, setNote] = useState(muni.policy?.note ?? '');
  const [saving, setSaving] = useState(false);

  function toggle<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/super-admin/muni-policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        municipalityId: muni.id,
        allowedScreens: Array.from(screens),
        allowedReports: Array.from(reports),
        exportEnabled, bulkExportEnabled,
        note: note || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  /* P1-1 프리셋 적용 — 세부 항목을 일괄로 채움. 적용 직후에도 사용자가 추가 조정 가능. */
  function applyPreset(key: PresetKey) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setScreens(new Set(p.allowedScreens));
    setReports(new Set(p.allowedReports));
    setExportEnabled(p.exportEnabled);
    setBulkExportEnabled(p.bulkExportEnabled);
  }

  return (
    <BottomSheet open={true} onClose={onClose} title={`${muni.name} — 권한 정책`} desktopMaxWidth="640px">
      <div className="px-5 py-2 bg-purple-50 border-b border-line">
        <div className="text-[0.6875rem] font-mono text-slate-600">{muni.code} · 관할 거래처 {muni.contractorCount}</div>
      </div>
      <div className="p-5 space-y-4">
        {/* P1-1: 프리셋 3종 일괄 적용 버튼 — 잘 모르면 [표준] */}
        <div>
          <div className="font-extrabold text-ink text-sm mb-2">⚡ 프리셋 일괄 적용 <span className="text-[0.6875rem] font-normal text-slate-500">(잘 모르면 [표준] 추천)</span></div>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className="px-2 py-2 rounded-md border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 active:scale-95 transition text-xs font-extrabold text-purple-900"
                title={p.description}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-[0.625rem] text-slate-500 mt-1.5 leading-snug">
            ※ 적용 후에도 아래 체크박스로 세부 조정 가능. 저장 누르기 전엔 반영 안 됩니다.
          </div>
        </div>
        <div>
          <div className="font-extrabold text-ink text-sm mb-2">허용 화면 ({screens.size}/{ALL_SCREENS.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_SCREENS.map((s) => (
              <label key={s.code} className={`flex items-center gap-1.5 p-2 rounded border-2 cursor-pointer text-xs font-bold transition min-h-[44px] sm:min-h-0 ${
                screens.has(s.code) ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-line bg-white text-slate-600 hover:border-blue-300'
              }`}>
                <input type="checkbox" checked={screens.has(s.code)} onChange={() => setScreens(toggle(screens, s.code))} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-extrabold text-ink text-sm mb-2">허용 보고서 ({reports.size}/{ALL_REPORTS.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_REPORTS.map((s) => (
              <label key={s.code} className={`flex items-center gap-1.5 p-2 rounded border-2 cursor-pointer text-xs font-bold transition min-h-[44px] sm:min-h-0 ${
                reports.has(s.code) ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-line bg-white text-slate-600 hover:border-emerald-300'
              }`}>
                <input type="checkbox" checked={reports.has(s.code)} onChange={() => setReports(toggle(reports, s.code))} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={exportEnabled} onChange={(e) => setExportEnabled(e.target.checked)} />
            자료 출력(인쇄·다운로드) 허용
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={bulkExportEnabled} onChange={(e) => setBulkExportEnabled(e.target.checked)} />
            관할 거래처 일괄 출력 허용 (대량 데이터)
          </label>
        </div>
        <div>
          <div className="text-[0.6875rem] font-mono font-extrabold text-slate-600 mb-1">메모</div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-1.5 rounded border border-line text-sm" />
        </div>
      </div>
      <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end gap-2 sticky bottom-0">
        <button onClick={onClose} className="px-4 py-2 rounded text-sm font-bold bg-white border border-line min-h-[44px]">취소</button>
        <button disabled={saving} onClick={save}
          className="px-5 py-2 rounded text-sm font-extrabold bg-purple-600 text-white disabled:opacity-50 min-h-[44px]">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─────────────  탭 2: 관할 거래처 일괄 조회  ───────────── */
function AggregateTab() {
  const [munis, setMunis] = useState<Muni[]>([]);
  const [muniId, setMuniId] = useState('');
  const ymStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const ymEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
  const [from, setFrom] = useState(ymStart);
  const [to, setTo] = useState(ymEnd);
  const [data, setData] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/super-admin/muni-policies').then((r) => r.json()).then((d) => {
      setMunis(d.items ?? []);
      if (d.items?.[0]) setMuniId(d.items[0].id);
    });
  }, []);

  async function load() {
    if (!muniId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/super-admin/contractors-aggregate?municipalityId=${muniId}&from=${from}&to=${to}`);
      setData(await r.json());
    } finally { setLoading(false); }
  }

  function printNow() { if (typeof window !== 'undefined') window.print(); }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">지자체</div>
          <select value={muniId} onChange={(e) => setMuniId(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-bold min-w-[180px]">
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.contractorCount}개 거래처)</option>)}
          </select>
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <button onClick={load} disabled={loading || !muniId}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
          {loading ? '조회 중…' : '🔍 조회'}
        </button>
        <button onClick={printNow} disabled={!data}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          🖨 일괄 출력
        </button>
      </div>

      {!data && <div className="text-center py-12 text-slate-500">지자체 선택 후 조회</div>}

      {data && (
        <div className="bg-white border-t-4 border-double border-purple-700 pt-4 px-4 print:px-2">
          <h1 className="text-2xl font-black text-center mb-1">{data.municipality.name} 관할 거래처 통합 보고서</h1>
          <div className="text-center text-sm font-bold text-slate-600 mb-4">
            {data.range.from} ~ {data.range.to} · 거래처 {data.contractors.length}개
          </div>

          {data.summary && (
            <div className="grid grid-cols-5 gap-3 mb-4 print:grid-cols-5">
              <KCard label="인원" value={data.summary.totalUsers} unit="명" />
              <KCard label="근태기록" value={data.summary.totalAttendance} unit="건" tone="accent" />
              <KCard label="민원" value={data.summary.totalComplaints} unit="건" tone="warning" />
              <KCard label="처리실적" value={data.summary.totalWasteTon} unit="ton" tone="success" />
              <KCard label="반입실적" value={data.summary.totalIntakeTon} unit="ton" tone="success" />
            </div>
          )}

          <div className="bg-surface border border-line rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-purple-50 border-b border-line text-sm font-extrabold text-ink">거래처별 상세 (모든 영역)</div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-700 uppercase">
                <tr>
                  <th className="px-2 py-1.5 text-left">거래처</th>
                  <th className="px-2 py-1.5 text-right">인원</th>
                  <th className="px-2 py-1.5 text-right">근태</th>
                  <th className="px-2 py-1.5 text-right">휴가(승인)</th>
                  <th className="px-2 py-1.5 text-right">민원</th>
                  <th className="px-2 py-1.5 text-right">차량(운행)</th>
                  <th className="px-2 py-1.5 text-right">현장수거(kg)</th>
                  <th className="px-2 py-1.5 text-right">처리(t)</th>
                  <th className="px-2 py-1.5 text-right">반입(t)</th>
                  <th className="px-2 py-1.5 text-right">안전</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.contractors.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">거래처 없음</td></tr>
                )}
                {data.contractors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5">
                      <div className="font-extrabold text-ink text-sm">{c.companyName}</div>
                      <div className="text-[0.625rem] font-mono text-slate-600">{c.businessNo}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold">{c.users}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.attendance}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.leavesApproved}/{c.leaves}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.complaints}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.vehicleLogs}/{c.vehicles}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.vehicleWasteKg.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold text-accent">{c.waste.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold text-emerald-700">{c.intake.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.safety}</td>
                  </tr>
                ))}
              </tbody>
              {data.summary && (
                <tfoot className="bg-purple-50 font-extrabold border-t-2 border-purple-300">
                  <tr>
                    <td className="px-2 py-2 font-extrabold text-purple-900">합계</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalUsers}</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalAttendance}</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalLeaves}</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalComplaints}</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalVehicleLogs}/{data.summary.totalVehicles}</td>
                    <td className="px-2 py-2 text-right font-mono">—</td>
                    <td className="px-2 py-2 text-right font-mono text-accent">{data.summary.totalWasteTon.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-700">{data.summary.totalIntakeTon.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right font-mono">{data.summary.totalSafety}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-6 pt-3 border-t-2 border-slate-700 grid grid-cols-3 gap-6 text-sm">
            {['담당자', '관리자', '대표'].map((role) => (
              <div key={role} className="text-center">
                <div className="font-bold mb-1">{role}</div>
                <div className="relative border border-slate-400 h-16 bg-white overflow-hidden">
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-slate-200 select-none pointer-events-none tracking-[0.4em] -rotate-12">서명</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[0.625rem] font-mono text-slate-600 text-right mt-3">
            출력일시: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      )}

      <style>{`@media print { @page { size: A4 landscape; margin: 1cm; } }`}</style>
    </div>
  );
}

function KCard({ label, value, unit, tone = 'default' }: { label: string; value: number; unit: string; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    accent: 'bg-cyan-100 border-cyan-500 text-cyan-900',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    warning: 'bg-amber-100 border-amber-500 text-amber-900',
  };
  return (
    <div className={`px-3 py-2 rounded border-2 ${c[tone]}`}>
      <div className="text-[0.625rem] font-mono font-extrabold uppercase">{label}</div>
      <div className="text-2xl font-black mt-0.5">{value}<span className="text-xs font-bold ml-1">{unit}</span></div>
    </div>
  );
}

/* ─────────────  탭 3: GIS API 설정 (실시간 차량조회에서 이관)  ───────────── */
function GisConfigTab() {
  const [config, setConfig] = useState<{
    gisProvider: string; gisBaseUrl: string | null; hasApiKey: boolean;
    embedUrl: string | null; refreshSec: number; active: boolean;
  } | null>(null);
  const [form, setForm] = useState({
    gisProvider: 'simulation', gisBaseUrl: '', apiKey: '', embedUrl: '',
    refreshSec: 5, active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/live-tracking/config').then((r) => r.json()).then((d) => {
      const c = d.config;
      setConfig(c);
      if (c) {
        setForm({
          gisProvider: c.gisProvider, gisBaseUrl: c.gisBaseUrl ?? '', apiKey: '',
          embedUrl: c.embedUrl ?? '', refreshSec: c.refreshSec, active: c.active,
        });
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      gisProvider: form.gisProvider,
      gisBaseUrl: form.gisBaseUrl || null,
      embedUrl: form.embedUrl || null,
      refreshSec: form.refreshSec, active: form.active,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;
    const res = await fetch('/api/live-tracking/config', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) alert('저장됨');
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5 max-w-[640px] space-y-3">
      <div className="text-sm font-extrabold text-ink mb-1">⚙ GIS API 설정 (실시간 차량조회 연동)</div>
      <div className="text-[0.6875rem] font-mono text-slate-600 bg-slate-50 rounded p-2 mb-2">
        💡 본 설정은 <code>/live-vehicles</code> 페이지의 GIS provider/embed에 적용됩니다 (전사 단일 설정).
      </div>
      <Field label="GIS Provider">
        <select value={form.gisProvider} onChange={(e) => setForm({ ...form, gisProvider: e.target.value })}
          className="w-full px-3 py-1.5 rounded border border-line text-sm font-bold">
          <option value="simulation">simulation (시안 시뮬)</option>
          <option value="helpbiz">helpbiz (gis.helpbiz.kr)</option>
          <option value="naver">naver maps</option>
          <option value="kakao">kakao mobility</option>
        </select>
      </Field>
      <Field label="GIS Base URL (API)">
        <input value={form.gisBaseUrl} onChange={(e) => setForm({ ...form, gisBaseUrl: e.target.value })}
          placeholder="https://gis.helpbiz.kr/api"
          className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
      </Field>
      <Field label="API Key (저장 시 AES-256 암호화)">
        <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          placeholder={config?.hasApiKey ? '••••••• (저장됨, 변경 시만 입력)' : 'API Key'}
          className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
      </Field>
      <Field label="Embed URL (외부 GIS 화면 직접 삽입 — 선택)">
        <input value={form.embedUrl} onChange={(e) => setForm({ ...form, embedUrl: e.target.value })}
          placeholder="https://gis.helpbiz.kr/embed?key=..."
          className="w-full px-3 py-1.5 rounded border border-line text-sm font-mono" />
      </Field>
      <Field label="갱신 주기 (초)">
        <input type="number" min="2" max="300" value={form.refreshSec} onChange={(e) => setForm({ ...form, refreshSec: Number(e.target.value) })}
          className="w-32 px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        연동 활성화
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
        <a href="/complaints"
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300 inline-flex items-center">
          닫기
        </a>
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[0.6875rem] font-mono font-extrabold text-slate-600 mb-1'} />;
}

/* 위탁업체 수정 모달 — SUPER_ADMIN 전용
   신규 등록과 동일한 필드 레이아웃. PATCH 2건 통합:
   - PATCH /api/contractors/[id]   : companyName / contractStart/End / status
   - PATCH /api/contractor/info     : ceoName / phoneMain / emailMain (회사 기본정보)
   사업자번호 / 지자체는 read-only (UNIQUE 무결성 보호) */
function ContractorEditModal({
  contractor,
  onClose,
  onSaved,
}: {
  contractor: {
    id: string;
    companyName: string;
    businessNo: string;
    municipalityName: string;
    status: string;
    contractStart?: string | null;
    contractEnd?: string | null;
    ceoName: string | null;
    phoneMain: string | null;
    emailMain: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    companyName: contractor.companyName,
    businessNo: contractor.businessNo,
    contractStart: contractor.contractStart ?? '',
    contractEnd: contractor.contractEnd ?? '',
    status: contractor.status as 'SETUP' | 'ACTIVE' | 'EXPIRED',
    ceoName: contractor.ceoName ?? '',
    phoneMain: contractor.phoneMain ?? '',
    emailMain: contractor.emailMain ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      /* 1) 위탁업체 기본 정보 */
      const r1 = await fetch(`/api/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          status: form.status,
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
        }),
      });
      if (!r1.ok) {
        const j = await r1.json().catch(() => ({}));
        setError(j.detail ?? j.error ?? `HTTP ${r1.status}`);
        return;
      }
      /* 2) 회사 기본 정보 (대표자/전화/이메일) */
      const r2 = await fetch('/api/contractor/info', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contractorId: contractor.id,
          ceoName: form.ceoName.trim() || null,
          phoneMain: form.phoneMain.trim() || null,
          emailMain: form.emailMain.trim() || null,
        }),
      });
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        setError('회사 기본정보 저장 실패: ' + (j.detail ?? j.error ?? `HTTP ${r2.status}`));
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={true} onClose={onClose} title="위탁업체 수정" desktopMaxWidth="600px">
      <div className="p-5 space-y-3">
        {/* 지자체 / 사업자번호 — read-only (변경 불가) */}
        <Field label="지자체 (변경 불가)">
          <input
            value={contractor.municipalityName}
            disabled
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-slate-100 text-slate-700 min-h-[44px]"
          />
        </Field>

        <Field label="업체명 *">
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold min-h-[44px]"
          />
        </Field>

        <Field label="사업자번호 (변경 불가)">
          <input
            value={form.businessNo}
            disabled
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold bg-slate-100 text-slate-700 min-h-[44px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="계약 시작일">
            <input
              type="date"
              value={form.contractStart}
              onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
            />
          </Field>
          <Field label="계약 종료일">
            <input
              type="date"
              value={form.contractEnd}
              onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
            />
          </Field>
        </div>

        <Field label="상태">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'SETUP' | 'ACTIVE' | 'EXPIRED' })}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface min-h-[44px]"
          >
            <option value="SETUP">설정 중 (SETUP)</option>
            <option value="ACTIVE">활성 (ACTIVE)</option>
            <option value="EXPIRED">계약 만료 (EXPIRED)</option>
          </select>
        </Field>

        <div className="border-t-2 border-purple-200 pt-3">
          <div className="text-xs font-extrabold text-purple-900 mb-2">📋 회사 기본 정보</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="대표자">
              <input
                value={form.ceoName}
                onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold min-h-[44px]"
              />
            </Field>
            <Field label="대표 전화">
              <input
                value={form.phoneMain}
                onChange={(e) => setForm({ ...form, phoneMain: e.target.value })}
                placeholder="02-1234-5678"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
              />
            </Field>
          </div>
          <Field label="이메일">
            <input
              type="email"
              value={form.emailMain}
              onChange={(e) => setForm({ ...form, emailMain: e.target.value })}
              placeholder="info@company.co.kr"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono min-h-[44px]"
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-xs font-bold text-red-800">
            오류: {error}
          </div>
        )}
      </div>
      <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm font-bold min-h-[44px]">취소</button>
        <button onClick={submit} disabled={saving || !form.companyName.trim()}
          className="px-5 py-2 rounded-md bg-amber-600 text-white text-sm font-extrabold disabled:opacity-50 min-h-[44px]">
          {saving ? '저장 중…' : '수정 완료'}
        </button>
      </footer>
    </BottomSheet>
  );
}

/* 위탁업체 신규 등록 모달 — SUPER_ADMIN 전용
   POST /api/contractors → 등록 후 회사정보 탭에서 자동 picker 선택 */
function ContractorCreateModal({
  onClose,
  onCreated,
  defaultMunicipalityId,
}: {
  onClose: () => void;
  onCreated: (newId: string) => void;
  defaultMunicipalityId?: string;
}) {
  const [munis, setMunis] = useState<{ id: string; name: string; region: string | null }[]>([]);
  const [form, setForm] = useState({
    municipalityId: defaultMunicipalityId ?? '',
    companyName: '',
    businessNo: '',
    contractStart: '',
    contractEnd: '',
    status: 'SETUP' as 'SETUP' | 'ACTIVE',
    ceoName: '',
    phoneMain: '',
    emailMain: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      })
      .catch(() => undefined);
  }, []);

  async function submit() {
    setError(null);
    if (!form.municipalityId) { setError('지자체를 선택해 주세요.'); return; }
    if (!form.companyName.trim()) { setError('업체명을 입력해 주세요.'); return; }
    if (!form.businessNo.trim()) { setError('사업자번호를 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          municipalityId: form.municipalityId,
          companyName: form.companyName.trim(),
          businessNo: form.businessNo.trim(),
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
          status: form.status,
          ceoName: form.ceoName.trim() || null,
          phoneMain: form.phoneMain.trim() || null,
          emailMain: form.emailMain.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail ?? j.error ?? `HTTP ${res.status}`);
        return;
      }
      onCreated(j.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={true} onClose={onClose} title="위탁업체 신규 등록" desktopMaxWidth="600px">
      <div className="p-5 space-y-3">
        <Field label="지자체 *">
          <select
            value={form.municipalityId}
            onChange={(e) => setForm({ ...form, municipalityId: e.target.value })}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface min-h-[44px]"
          >
            <option value="">— 지자체 선택 —</option>
            {munis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.region ? `[${m.region}] ` : ''}{m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="업체명 *">
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="(주)○○환경"
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold min-h-[44px]"
          />
        </Field>

        <Field label="사업자번호 *">
          <input
            value={form.businessNo}
            onChange={(e) => setForm({ ...form, businessNo: e.target.value })}
            placeholder="123-45-67890"
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="계약 시작일">
            <input
              type="date"
              value={form.contractStart}
              onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
            />
          </Field>
          <Field label="계약 종료일">
            <input
              type="date"
              value={form.contractEnd}
              onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
            />
          </Field>
        </div>

        <Field label="상태">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'SETUP' | 'ACTIVE' })}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface min-h-[44px]"
          >
            <option value="SETUP">설정 중 (SETUP)</option>
            <option value="ACTIVE">활성 (ACTIVE)</option>
          </select>
        </Field>

        <div className="border-t-2 border-purple-200 pt-3">
          <div className="text-xs font-extrabold text-purple-900 mb-2">📋 회사 기본 정보 (선택)</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="대표자">
              <input
                value={form.ceoName}
                onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold min-h-[44px]"
              />
            </Field>
            <Field label="대표 전화">
              <input
                value={form.phoneMain}
                onChange={(e) => setForm({ ...form, phoneMain: e.target.value })}
                placeholder="02-1234-5678"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold min-h-[44px]"
              />
            </Field>
          </div>
          <Field label="이메일">
            <input
              type="email"
              value={form.emailMain}
              onChange={(e) => setForm({ ...form, emailMain: e.target.value })}
              placeholder="info@company.co.kr"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono min-h-[44px]"
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-xs font-bold text-red-800">
            오류: {error}
          </div>
        )}
      </div>

      <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface min-h-[44px]"
        >
          취소
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-5 py-2 rounded-md bg-emerald-700 text-white text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-50 min-h-[44px]"
        >
          {busy ? '등록 중…' : '등록'}
        </button>
      </footer>
    </BottomSheet>
  );
}
