'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from '@/components/SignaturePad';
import ProfilePhotoUploader from '@/components/ProfilePhotoUploader';
import ApprovalSignatureModal from '@/components/ApprovalSignatureModal';
import { formatKoreanPhone } from '@/lib/phone';
import OrgSettingsTab from './_org-settings-tab';

const POSITION_CATEGORY_COLOR: Record<string, string> = {
  OFFICE: 'bg-blue-100 text-blue-700 border-blue-300',
  FIELD: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  OTHER: 'bg-slate-100 text-slate-600 border-slate-300',
};
const POSITION_CATEGORY_LABEL: Record<string, string> = { OFFICE: '사무', FIELD: '현장', OTHER: '기타' };

export type PositionRow = { id: string; code: string; label: string; category: string; sortOrder: number };
export type DepartmentRow = { id: string; name: string; parentId: string | null };

export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  contractorName: string | null;
  contractorId: string | null;
  municipalityName: string | null;
  municipalityId: string | null;
  municipalityRegion: string | null;
  phone: string | null;
  employeeNo: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  hireDate: string | null;
  resignDate: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  memo: string | null;
  lastLogin: string | null;
  tenureYears: number;
  recommendDays: number;
  recommendRule: string;
  thisYearGranted: number;
  thisYearUsed: number;
  thisYearCarriedOver: number;
  thisYearRemaining: number;
  position: { id: string; code: string; label: string; category: string } | null;
  department: { id: string; name: string } | null;
  /* AVAC 보강 (Hot-fix 2026-05-02) — 직급·주근무지 */
  rank: string | null;
  primaryFacility: { id: string; name: string; type: string } | null;
  profilePhotoUrl: string | null;
  activeSignatureRef: string | null;
  /* contractor-org-master — 업체별 직책·직급 */
  contractorPositionId: string | null;
  contractorRankId: string | null;
  contractorPosition: { id: string; name: string; category: string } | null;
  contractorRank: { id: string; name: string; level: number } | null;
};

/* AVAC 보강 — 직급 라벨 */
export const RANK_OPTIONS: { code: string; label: string; group: string }[] = [
  { code: 'ENGINEER_MASTER',   label: '기술사',         group: '엔지니어링' },
  { code: 'ENGINEER_SENIOR',   label: '특급기술자',     group: '엔지니어링' },
  { code: 'ENGINEER_HIGH',     label: '고급기술자',     group: '엔지니어링' },
  { code: 'ENGINEER_MID',      label: '중급기술자',     group: '엔지니어링' },
  { code: 'ENGINEER_BEGINNER', label: '초급기술자',     group: '엔지니어링' },
  { code: 'SKILL_HIGH',        label: '고급숙련기술자', group: '숙련' },
  { code: 'SKILL_MID',         label: '중급숙련기술자', group: '숙련' },
  { code: 'SKILL_BEGINNER',    label: '초급숙련기술자', group: '숙련' },
  { code: 'LABORER',           label: '단순노무종사원', group: '단순노무' },
];

export type FacilityRow = { id: string; name: string; type: string };

export type LeaveRow = {
  id: string;
  workerId: string;
  workerName: string;
  employeeNo: string | null;
  requestType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
  approverName: string | null;
  approverSignatureUrl: string | null;
  approverSignatureRef: string | null;
};

/* 사용자 요청 2026-04-29: 권한 라벨 재정의 (DB enum 값은 유지, 표시 라벨만 변경).
   근로자=WORKER / 프로그램관리자=INTERNAL_ADMIN / 대표=CONTRACTOR_ADMIN / 지자체관리자=MUNI_ADMIN. */
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '슈퍼관리자',
  MUNI_ADMIN: '지자체관리자',
  CONTRACTOR_ADMIN: '대표',
  INTERNAL_ADMIN: '프로그램관리자',
  WORKER: '근로자',
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: '활성', INACTIVE: '비활성', PENDING: '대기' };
const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  ANNUAL_HALF: '연차(반차)',
  SPECIAL: '경조사',
  MATERNITY: '출산',
  FAMILY_CARE: '가족돌봄',
  MENSTRUAL: '생리',
  OFFICIAL: '공가',
  SICK: '병가',
  BUSINESS_TRIP: '출장',
  TRAINING: '교육',
  OTHER: '기타',
};
const LEAVE_STATUS_LABEL: Record<string, string> = {
  PENDING: '신청',
  IN_REVIEW: '결재 중',
  APPROVED: '결재 완료',
  REJECTED: '반려',
};
/* 핵심 7종 (신청 시 우선 노출) */
const PRIMARY_LEAVE_TYPES = ['ANNUAL', 'ANNUAL_HALF', 'SPECIAL', 'MATERNITY', 'FAMILY_CARE', 'MENSTRUAL', 'OFFICIAL'] as const;
const SECONDARY_LEAVE_TYPES = ['SICK', 'BUSINESS_TRIP', 'TRAINING', 'OTHER'] as const;

export default function UsersClient({
  session, rows, leaveRows, year, positions, departments,
}: {
  session: { role: string; userId: string };
  rows: UserRow[];
  leaveRows: LeaveRow[];
  year: number;
  positions: PositionRow[];
  departments: DepartmentRow[];
}) {
  const [tab, setTab] = useState<'register' | 'profile' | 'leave' | 'calendar' | 'report' | 'org' | 'org-settings'>('register');
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [showLeaveCreate, setShowLeaveCreate] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [showBulkGrant, setShowBulkGrant] = useState(false);
  const router = useRouter();

  const canManage = session.role === 'SUPER_ADMIN' || session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN';

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">사용자관리</h2>
        <span className="text-xs font-mono font-bold text-slate-600">총 {rows.length}명 / 활성 {rows.filter((r) => r.status === 'ACTIVE').length}명</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => router.refresh()}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-white border border-line text-ink hover:bg-slate-50"
          >새로고침</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b-2 border-line">
        <TabButton active={tab === 'register'} onClick={() => setTab('register')}>사용자 등록</TabButton>
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>인적사항</TabButton>
        <TabButton active={tab === 'leave'} onClick={() => setTab('leave')}>연월차관리</TabButton>
        <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>휴가 캘린더</TabButton>
        <TabButton active={tab === 'report'} onClick={() => setTab('report')}>휴가 보고서</TabButton>
        <TabButton active={tab === 'org'} onClick={() => setTab('org')}>조직도</TabButton>
        {(session.role === 'SUPER_ADMIN' || session.role === 'CONTRACTOR_ADMIN') && (
          <TabButton active={tab === 'org-settings'} onClick={() => setTab('org-settings')}>조직 설정</TabButton>
        )}
      </div>

      {tab === 'register' && (
        <RegisterTab
          rows={rows}
          canManage={canManage}
          currentUserId={session.userId}
          isSuperAdmin={session.role === 'SUPER_ADMIN'}
          onSelectProfile={(id) => { setSelectedId(id); setTab('profile'); }}
          onAdd={() => setShowCreate(true)}
          positions={positions}
          departments={departments}
        />
      )}

      {tab === 'profile' && (
        <ProfileTab
          rows={rows}
          selected={selected}
          onSelect={setSelectedId}
          canManage={canManage}
          positions={positions}
          departments={departments}
        />
      )}

      {tab === 'leave' && (
        <LeaveTab
          rows={rows}
          leaveRows={leaveRows}
          year={year}
          selected={selected}
          onSelect={setSelectedId}
          canManage={canManage}
          onGrant={() => setShowGrant(true)}
          onCreate={() => setShowLeaveCreate(true)}
          onNotify={() => setShowNotify(true)}
          onBulkGrant={() => setShowBulkGrant(true)}
        />
      )}

      {tab === 'calendar' && <CalendarTab />}

      {tab === 'report' && <ReportTab />}

      {tab === 'org' && <OrgChartTab canManage={canManage} allUsers={rows} positions={positions} />}

      {tab === 'org-settings' && <OrgSettingsTab />}

      {showCreate && canManage && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          canPickContractor={session.role === 'SUPER_ADMIN'}
          positions={positions}
          departments={departments}
          sessionRole={session.role}
        />
      )}
      {showGrant && canManage && selected && (
        <GrantLeaveModal user={selected} year={year} onClose={() => setShowGrant(false)} />
      )}
      {showLeaveCreate && selected && (
        <CreateLeaveRequestModal user={selected} onClose={() => setShowLeaveCreate(false)} />
      )}
      {showNotify && canManage && (
        <LeaveNotifyModal year={year} onClose={() => setShowNotify(false)} />
      )}
      {showBulkGrant && canManage && (
        <BulkGrantModal year={year} onClose={() => setShowBulkGrant(false)} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-[0.9375rem] font-black tracking-tight border-b-[3px] -mb-0.5 transition ${
        active
          ? 'border-accent text-accent bg-accent-soft'
          : 'border-transparent text-slate-700 hover:text-ink hover:bg-slate-100'
      }`}
    >{children}</button>
  );
}

/* ────────────────────────  탭 1: 사용자 등록  ──────────────────────── */
function RegisterTab({
  rows, canManage, currentUserId, isSuperAdmin, onSelectProfile, onAdd, positions, departments,
}: {
  rows: UserRow[]; canManage: boolean; currentUserId: string; isSuperAdmin: boolean;
  onSelectProfile: (id: string) => void; onAdd: () => void;
  positions: PositionRow[]; departments: DepartmentRow[];
}) {
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [muniFilter, setMuniFilter] = useState('');       // 지자체 ID
  const [contractorFilter, setContractorFilter] = useState(''); // 위탁업체 ID
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const router = useRouter();

  /* SUPER_ADMIN 용 — rows에서 추출한 지자체·위탁업체 옵션 (계층 의존) */
  const muniOptions = useMemo(() => {
    const map = new Map<string, { name: string; region: string | null }>();
    for (const r of rows) {
      if (r.municipalityId && r.municipalityName) {
        map.set(r.municipalityId, { name: r.municipalityName, region: r.municipalityRegion });
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, region: v.region }))
      .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '', 'ko') || a.name.localeCompare(b.name, 'ko'));
  }, [rows]);

  const contractorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.contractorId || !r.contractorName) continue;
      if (muniFilter && r.municipalityId !== muniFilter) continue;
      map.set(r.contractorId, r.contractorName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [rows, muniFilter]);

  /* 지자체 변경 시 위탁업체 자동 초기화 */
  useEffect(() => {
    if (contractorFilter && !contractorOptions.find((c) => c.id === contractorFilter)) {
      setContractorFilter('');
    }
  }, [contractorOptions, contractorFilter]);

  const filtered = rows.filter((r) => {
    if (q && !(r.name.includes(q) || r.username.includes(q) || (r.employeeNo ?? '').includes(q))) return false;
    if (roleFilter && r.role !== roleFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (muniFilter && r.municipalityId !== muniFilter) return false;
    if (contractorFilter && r.contractorId !== contractorFilter) return false;
    return true;
  });

  async function disable(id: string) {
    if (!confirm('해당 사용자를 비활성화하시겠습니까?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="이름·아이디·사번 검색"
          className="px-3 py-1.5 rounded border border-line bg-white text-sm w-56"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="권한 필터" className="px-3 py-1.5 rounded border border-line bg-white text-sm">
          <option value="">전체 권한</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="상태 필터" className="px-3 py-1.5 rounded border border-line bg-white text-sm">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {isSuperAdmin && (
          <>
            <select value={muniFilter} onChange={(e) => setMuniFilter(e.target.value)} aria-label="지자체 필터" className="px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="">전체 지자체</option>
              {muniOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.region ? `[${m.region}] ` : ''}{m.name}
                </option>
              ))}
            </select>
            <select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} aria-label="위탁업체 필터" className="px-3 py-1.5 rounded border border-line bg-white text-sm" disabled={contractorOptions.length === 0}>
              <option value="">전체 업체</option>
              {contractorOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        {canManage && (
          <button onClick={onAdd} className="ml-auto px-4 py-1.5 rounded-md text-xs font-extrabold bg-accent text-white hover:bg-accent-strong">
            + 신규 사용자
          </button>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        {/* 사용자 요청 2026-04-29: 리스트 컬럼 5종(이름/아이디/권한/입사일/상태)만 노출.
            숨김: avatar / 직책 / 사번 / 지자체·업체 / 부서 / 전화 / 서명. 액션(수정/상세/비활성화)은 유지. */}
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-100 text-[0.6875rem] font-mono font-extrabold text-slate-700 uppercase tracking-wider">
            <tr>
              {/* 사용자 요청 2026-04-29 v2: 권한/직책 컬럼 제거 — 이름/아이디/상태 + 상태변경만 */}
              <th className="px-3 py-2 text-center">이름</th>
              <th className="px-3 py-2 text-center">아이디</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-center">상태변경</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-700 font-bold">조건에 맞는 사용자가 없습니다.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-bold text-ink text-sm">{u.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canManage && (
                    <button onClick={() => setEditTarget(u)} className="text-xs font-bold text-accent hover:underline mr-2">수정</button>
                  )}
                  <button onClick={() => onSelectProfile(u.id)} className="text-xs font-bold text-slate-600 hover:underline mr-2">상세</button>
                  {canManage && u.status === 'ACTIVE' && u.id !== currentUserId && (
                    <button onClick={() => disable(u.id)} className="text-xs font-bold text-red-600 hover:underline">비활성화</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {editTarget && (
        <EditUserModal
          user={editTarget}
          positions={positions}
          departments={departments}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, positions, departments, onClose }: {
  user: UserRow;
  positions: PositionRow[];
  departments: DepartmentRow[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{
    address: string | null; bankName: string | null; bankAccount: string | null;
    emergencyContact: string | null; emergencyPhone: string | null;
    birthDate: string | null; hireDate: string | null;
  } | null>(null);
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    employeeNo: user.employeeNo ?? '',
    status: user.status as 'ACTIVE' | 'INACTIVE' | 'PENDING',
    positionCode: user.position?.code ?? '',
    departmentId: user.department?.id ?? '',
    rank: user.rank ?? '',                                /* AVAC 보강 */
    primaryFacilityId: user.primaryFacility?.id ?? '',    /* AVAC 보강 */
    birthDate: user.birthDate ?? '',
    hireDate: user.hireDate ?? '',
    address: '',
    bankName: '',
    bankAccount: '',
    emergencyContact: '',
    emergencyPhone: '',
    password: '',
  });
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);

  /* 본 contractor·munis 산하 active facility 목록 로드 */
  useEffect(() => {
    fetch('/api/super-admin/facilities?active=true')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const items: FacilityRow[] = (j.items ?? []).map((f: { id: string; name: string; type: string }) => ({
          id: f.id, name: f.name, type: f.type,
        }));
        setFacilities(items);
      })
      .catch(() => setFacilities([]));
  }, []);
  const [photo, setPhoto] = useState<string | null>(user.profilePhotoUrl);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureChanged, setSignatureChanged] = useState(false);
  const [consentPII, setConsentPII] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/users/${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        setDetail({
          address: u.address, bankName: u.bankName, bankAccount: u.bankAccount,
          emergencyContact: u.emergencyContact, emergencyPhone: u.emergencyPhone,
          birthDate: u.birthDate, hireDate: u.hireDate,
        });
        setForm((f) => ({
          ...f,
          address: u.address ?? '',
          bankName: u.bankName ?? '',
          bankAccount: u.bankAccount ?? '',
          emergencyContact: u.emergencyContact ?? '',
          emergencyPhone: u.emergencyPhone ?? '',
        }));
      })
      .finally(() => setLoading(false));
  }, [user.id]);

  async function submit() {
    if (photoChanged && photo && !consentPII) {
      alert('개인정보 동의 필요');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {};
    /* 변경된 필드만 전송 — 평문 비교 (서버 측 PII는 평문 비교 후 암호화) */
    if (form.name !== user.name) payload.name = form.name;
    if (form.phone !== (user.phone ?? '')) payload.phone = form.phone || null;
    if (form.employeeNo !== (user.employeeNo ?? '')) payload.employeeNo = form.employeeNo || null;
    if (form.status !== user.status) payload.status = form.status;
    if (form.positionCode !== (user.position?.code ?? '')) payload.positionCode = form.positionCode || null;
    if (form.departmentId !== (user.department?.id ?? '')) payload.departmentId = form.departmentId || null;
    if (form.rank !== (user.rank ?? '')) payload.rank = form.rank || null;
    if (form.primaryFacilityId !== (user.primaryFacility?.id ?? '')) payload.primaryFacilityId = form.primaryFacilityId || null;
    if (form.birthDate !== (user.birthDate ?? '')) payload.birthDate = form.birthDate || null;
    if (form.hireDate !== (user.hireDate ?? '')) payload.hireDate = form.hireDate || null;
    if (detail) {
      if (form.address !== (detail.address ?? '')) payload.address = form.address || null;
      if (form.bankName !== (detail.bankName ?? '')) payload.bankName = form.bankName || null;
      if (form.bankAccount !== (detail.bankAccount ?? '')) payload.bankAccount = form.bankAccount || null;
      if (form.emergencyContact !== (detail.emergencyContact ?? '')) payload.emergencyContact = form.emergencyContact || null;
      if (form.emergencyPhone !== (detail.emergencyPhone ?? '')) payload.emergencyPhone = form.emergencyPhone || null;
    }
    if (form.password) payload.password = form.password;
    if (photoChanged) {
      payload.profilePhoto = photo;
      if (photo) payload.consentPII = consentPII;
    }
    if (signatureChanged) payload.signature = signature;

    if (Object.keys(payload).length === 0) {
      alert('변경된 항목이 없습니다.');
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      alert('저장되었습니다.');
      onClose();
      router.refresh();
    } else {
      alert('실패: ' + (await res.json().catch(() => ({}))).error);
    }
  }

  return (
    <Modal title={`${user.name} 수정`} onClose={onClose}>
      {loading && <div className="text-center py-6 text-slate-500 text-sm">불러오는 중…</div>}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="비밀번호 (변경 시 입력)"><Input type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="6자 이상" /></Field>
          <Field label="권한"><Input value={user.role} onChange={() => { /* readonly */ }} disabled /></Field>
          <Field label="상태">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="ACTIVE">활성</option>
              <option value="INACTIVE">비활성</option>
              <option value="PENDING">대기</option>
            </select>
          </Field>

          <div className="col-span-2 mt-2 text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest">직무</div>
          <Field label="직책">
            <select value={form.positionCode} onChange={(e) => setForm({ ...form, positionCode: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="">미지정</option>
              <PositionOptGroup positions={positions} category="OFFICE" />
              <PositionOptGroup positions={positions} category="FIELD" />
              <PositionOptGroup positions={positions} category="OTHER" />
            </select>
          </Field>
          <Field label="부서">
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="">미지정</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          {/* AVAC 보강 (Hot-fix 2026-05-02) — 직급 + 주근무지 시설 */}
          <Field label="직급">
            <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="">미지정</option>
              <optgroup label="엔지니어링">
                {RANK_OPTIONS.filter((r) => r.group === '엔지니어링').map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="숙련">
                {RANK_OPTIONS.filter((r) => r.group === '숙련').map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </optgroup>
              <optgroup label="단순노무">
                {RANK_OPTIONS.filter((r) => r.group === '단순노무').map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="주근무지(시설)">
            <select value={form.primaryFacilityId} onChange={(e) => setForm({ ...form, primaryFacilityId: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="">미배치</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.type === 'AVAC' ? '🏭 ' : ''}{f.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="사번"><Input value={form.employeeNo} onChange={(v) => setForm({ ...form, employeeNo: v })} /></Field>
          <Field label="전화"><Input type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="010-1234-5678" /></Field>
          <Field label="생년월일"><Input type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} /></Field>
          <Field label="입사일"><Input type="date" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} /></Field>
          <Field label="주소" colSpan={2}><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>

          <div className="col-span-2 mt-2 text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest">비상연락 / 계좌</div>
          <Field label="비상연락 이름"><Input value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} /></Field>
          <Field label="비상연락 전화"><Input type="tel" value={form.emergencyPhone} onChange={(v) => setForm({ ...form, emergencyPhone: v })} placeholder="010-1234-5678" /></Field>
          <Field label="은행"><Input value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} /></Field>
          <Field label="계좌번호"><Input value={form.bankAccount} onChange={(v) => setForm({ ...form, bankAccount: v })} /></Field>

          <div className="col-span-2 mt-2 text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest">자료 등록 (변경 시)</div>
          <Field label="프로필 사진" colSpan={2}>
            <ProfilePhotoUploader initialDataUrl={photo} onChange={(d) => { setPhoto(d); setPhotoChanged(true); }} size={64} />
            {photoChanged && photo && (
              <label className="flex items-center gap-2 mt-2 text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                <input type="checkbox" checked={consentPII} onChange={(e) => setConsentPII(e.target.checked)} />
                개인정보(사진) 수집·이용 동의 (필수)
              </label>
            )}
          </Field>
          <Field label="서명 (재서명 시 기존 비활성)" colSpan={2}>
            <SignaturePad onChange={(d) => { setSignature(d); setSignatureChanged(true); }} height={120} />
            {user.activeSignatureRef && !signatureChanged && (
              <div className="text-[0.625rem] font-mono text-emerald-700 mt-1">
                현재 등록 서명 ref: {user.activeSignatureRef}
              </div>
            )}
          </Field>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
        <button disabled={saving || loading} onClick={submit}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </Modal>
  );
}

/* ────────────────────────  탭 2: 인적사항  ──────────────────────── */
function ProfileTab({
  rows, selected, onSelect, canManage, positions, departments,
}: {
  rows: UserRow[]; selected: UserRow | null;
  onSelect: (id: string) => void; canManage: boolean;
  positions: PositionRow[]; departments: DepartmentRow[];
}) {
  /* 사용자 요청 2026-04-29 v3: 좌측 사용자 목록 다시 숨김.
     [사용자 등록] 탭의 [상세] 버튼 → onSelectProfile 핸들러가 setTab('profile') + setSelectedId(id) 처리
     → 자동으로 이 탭으로 이동 + 해당 사용자 ProfileEditor 표출. rows/onSelect 는 호환 유지. */
  void rows; void onSelect;
  return (
    <div>
      {selected ? (
        <ProfileEditor user={selected} canManage={canManage} positions={positions} departments={departments} />
      ) : (
        <div className="bg-surface border border-line rounded-lg p-10 text-center text-slate-500">
          [사용자 등록] 탭에서 [상세] 버튼을 눌러 인적사항을 조회하세요.
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ user, canManage, positions, departments }: { user: UserRow; canManage: boolean; positions: PositionRow[]; departments: DepartmentRow[] }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    employeeNo: user.employeeNo ?? '',
    birthDate: user.birthDate ?? '',
    gender: user.gender ?? '',
    address: user.address ?? '',
    hireDate: user.hireDate ?? '',
    resignDate: user.resignDate ?? '',
    emergencyContact: user.emergencyContact ?? '',
    emergencyPhone: user.emergencyPhone ?? '',
    bankName: user.bankName ?? '',
    bankAccount: user.bankAccount ?? '',
    memo: user.memo ?? '',
    password: '',
    positionCode: user.position?.code ?? '',
    departmentId: user.department?.id ?? '',
    contractorPositionId: user.contractorPositionId ?? '',
    contractorRankId: user.contractorRankId ?? '',
  });
  const [orgOptions, setOrgOptions] = useState<{ positions: { id: string; name: string }[]; ranks: { id: string; name: string }[] }>({ positions: [], ranks: [] });
  useEffect(() => {
    fetch('/api/contractor/positions').then((r) => r.json()).then((d) => setOrgOptions((o) => ({ ...o, positions: d.positions ?? [] }))).catch(() => {});
    fetch('/api/contractor/ranks').then((r) => r.json()).then((d) => setOrgOptions((o) => ({ ...o, ranks: d.ranks ?? [] }))).catch(() => {});
  }, []);
  const [photo, setPhoto] = useState<string | null>(user.profilePhotoUrl);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureChanged, setSignatureChanged] = useState(false);
  const [consentPII, setConsentPII] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'password' && !v) return;
      if (k === 'contractorRankId') { payload.rankId = v === '' ? null : v; return; }
      if (typeof v === 'string' && v === '') payload[k] = null;
      else payload[k] = v;
    });
    if (photoChanged) {
      payload.profilePhoto = photo;       // null = 제거
      if (photo) payload.consentPII = consentPII;
    }
    if (signatureChanged) {
      payload.signature = signature;
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      alert('저장되었습니다.');
      router.refresh();
    } else {
      alert('실패: ' + (await res.json().catch(() => ({}))).error);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-100 border-b border-line flex items-center gap-2">
        <span className="font-extrabold text-ink">{user.name}</span>
        <RoleBadge role={user.role} />
        <StatusBadge status={user.status} />
        <span className="ml-auto text-[0.625rem] font-mono text-slate-600">사번 {user.employeeNo ?? '—'}</span>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">
        <Section title="기본 정보">
          <Field label="이름"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} disabled={!canManage} /></Field>
          <Field label="사번"><Input value={form.employeeNo} onChange={(v) => setForm({ ...form, employeeNo: v })} disabled={!canManage} /></Field>
          <Field label="전화번호"><Input type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="010-1234-5678" disabled={!canManage} /></Field>
          <Field label="비밀번호 변경"><Input type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="6자 이상 (변경 시 입력)" disabled={!canManage} /></Field>
        </Section>

        <Section title="인적사항">
          <Field label="생년월일"><Input type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} disabled={!canManage} /></Field>
          <Field label="성별">
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} disabled={!canManage}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50">
              <option value="">선택</option><option value="M">남</option><option value="F">여</option>
            </select>
          </Field>
          <Field label="주소" colSpan={2}><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} disabled={!canManage} /></Field>
        </Section>

        <Section title="입·퇴사">
          <Field label="입사일"><Input type="date" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} disabled={!canManage} /></Field>
          <Field label="퇴사일"><Input type="date" value={form.resignDate} onChange={(v) => setForm({ ...form, resignDate: v })} disabled={!canManage} /></Field>
          <div className="col-span-2 px-3 py-2 rounded bg-accent-soft border border-accent text-xs font-bold text-accent">
            근속 {user.tenureYears}년 · 권장 연차 {user.recommendDays}일 ({user.recommendRule})
          </div>
        </Section>

        <Section title="비상연락처">
          <Field label="이름"><Input value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} disabled={!canManage} /></Field>
          <Field label="전화"><Input type="tel" value={form.emergencyPhone} onChange={(v) => setForm({ ...form, emergencyPhone: v })} placeholder="010-1234-5678" disabled={!canManage} /></Field>
        </Section>

        <Section title="급여 계좌">
          <Field label="은행명"><Input value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} disabled={!canManage} /></Field>
          <Field label="계좌번호"><Input value={form.bankAccount} onChange={(v) => setForm({ ...form, bankAccount: v })} disabled={!canManage} /></Field>
        </Section>

        <Section title="직무">
          <Field label="직책">
            <select value={form.positionCode} onChange={(e) => setForm({ ...form, positionCode: e.target.value })} disabled={!canManage}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50">
              <option value="">미지정</option>
              <PositionOptGroup positions={positions} category="OFFICE" />
              <PositionOptGroup positions={positions} category="FIELD" />
              <PositionOptGroup positions={positions} category="OTHER" />
            </select>
          </Field>
          <Field label="부서">
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} disabled={!canManage}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50">
              <option value="">미지정</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="업체 직책·직급">
          <Field label="직책">
            <select value={form.contractorPositionId} onChange={(e) => setForm({ ...form, contractorPositionId: e.target.value })} disabled={!canManage}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50">
              <option value="">미지정</option>
              {orgOptions.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="직급">
            <select value={form.contractorRankId} onChange={(e) => setForm({ ...form, contractorRankId: e.target.value })} disabled={!canManage}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50">
              <option value="">미지정</option>
              {orgOptions.ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="프로필 자료" colSpan={2}>
          <Field label="프로필 사진" colSpan={2}>
            {canManage ? (
              <>
                <ProfilePhotoUploader
                  initialDataUrl={photo}
                  onChange={(d) => { setPhoto(d); setPhotoChanged(true); }}
                  size={72}
                />
                {photoChanged && photo && (
                  <label className="flex items-center gap-2 mt-2 text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                    <input type="checkbox" checked={consentPII} onChange={(e) => setConsentPII(e.target.checked)} />
                    개인정보(사진) 수집·이용 동의 (필수)
                  </label>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar url={photo} name={user.name} size={72} />
              </div>
            )}
          </Field>
          <Field label="서명" colSpan={2}>
            <div className="flex gap-3">
              <div className="flex-1">
                <SignaturePad
                  onChange={(d) => { setSignature(d); setSignatureChanged(true); }}
                  height={120}
                />
              </div>
              {user.activeSignatureRef && !signatureChanged && (
                <div className="w-[160px] flex flex-col items-center justify-center bg-slate-50 border border-line rounded p-2">
                  <span className="text-[0.625rem] font-mono font-bold text-slate-600 mb-1">현재 서명</span>
                  <span className="text-[0.5625rem] font-mono text-emerald-700">ref: {user.activeSignatureRef}</span>
                </div>
              )}
            </div>
            <div className="text-[0.625rem] font-mono text-slate-500 mt-1">서명을 다시 그리면 기존 서명은 비활성화됩니다.</div>
          </Field>
        </Section>

        <Section title="비고" colSpan={2}>
          <Field colSpan={2}>
            <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} disabled={!canManage} rows={3}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50" />
          </Field>
        </Section>
      </div>
      {canManage && (
        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end">
          <button disabled={saving} onClick={save}
            className="px-5 py-1.5 rounded-md text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      )}

      {/* 변경 이력 */}
      <AuditHistory userId={user.id} />
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  name: '이름', phone: '전화번호', employeeNo: '사번', status: '상태',
  birthDate: '생년월일', gender: '성별', address: '주소',
  hireDate: '입사일', resignDate: '퇴사일',
  emergencyContact: '비상연락 이름', emergencyPhone: '비상연락 전화',
  bankName: '은행', bankAccount: '계좌번호', memo: '비고',
};

function fmtVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function AuditHistory({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{
    id: string; action: string; actorName: string | null; actorRole: string | null;
    metadata: unknown; createdAt: string;
  }> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/users/${userId}/audit`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [open, userId]);

  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 text-left flex items-center"
      >
        <span className="text-sm font-extrabold text-ink">변경 이력</span>
        <span className="ml-2 text-[0.625rem] font-mono text-slate-600">audit_logs</span>
        <span className="ml-auto text-slate-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
          {items === null && <div className="text-center text-slate-500 py-6 text-sm">불러오는 중…</div>}
          {items && items.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">변경 이력이 없습니다.</div>}
          {items && items.length > 0 && (
            <div className="space-y-2">
              {items.map((l) => {
                const meta = (l.metadata ?? {}) as { changes?: Record<string, { from: unknown; to: unknown }>; passwordChanged?: boolean };
                const changeKeys = meta.changes ? Object.keys(meta.changes) : [];
                return (
                  <div key={l.id} className="border border-line rounded-md p-3 bg-white">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ActionBadge action={l.action} />
                      <span className="text-xs font-bold text-ink">{l.actorName ?? '시스템'}</span>
                      {l.actorRole && <span className="text-[0.5625rem] font-mono font-bold text-slate-600">{l.actorRole}</span>}
                      <span className="ml-auto text-[0.625rem] font-mono text-slate-600">
                        {new Date(l.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    {changeKeys.length > 0 && meta.changes && (
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-xs">
                        <thead>
                          <tr className="text-[0.5625rem] font-mono font-bold text-slate-600 border-b border-line">
                            <th className="text-left py-1 pr-2 w-[120px]">필드</th>
                            <th className="text-left py-1 pr-2">이전</th>
                            <th className="text-left py-1">변경</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changeKeys.map((k) => (
                            <tr key={k} className="border-b border-line/50 last:border-0">
                              <td className="py-1.5 pr-2 font-bold text-slate-600">{FIELD_LABEL[k] ?? k}</td>
                              <td className="py-1.5 pr-2 font-mono text-slate-600 line-through">{fmtVal(meta.changes![k].from)}</td>
                              <td className="py-1.5 font-mono font-extrabold text-accent">{fmtVal(meta.changes![k].to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    )}
                    {meta.passwordChanged && (
                      <div className="text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1 mt-2">
                        🔒 비밀번호 변경됨
                      </div>
                    )}
                    {l.action === 'USER_DISABLE' && (
                      <div className="text-[0.6875rem] font-bold text-red-700">사용자 비활성화</div>
                    )}
                    {l.action === 'USER_CREATE' && (
                      <div className="text-[0.6875rem] font-bold text-emerald-700">사용자 신규 등록</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    USER_CREATE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    USER_UPDATE: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    USER_DISABLE: 'bg-red-100 text-red-700 border-red-300',
  };
  const labels: Record<string, string> = {
    USER_CREATE: '등록', USER_UPDATE: '수정', USER_DISABLE: '비활성',
  };
  return <span className={`text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border ${colors[action] ?? 'bg-slate-100 text-slate-600 border-slate-300'}`}>{labels[action] ?? action}</span>;
}

/* ────────────────────────  탭 3: 연월차관리  ──────────────────────── */
function LeaveTab({
  rows, leaveRows, year, selected, onSelect, canManage, onGrant, onCreate, onNotify, onBulkGrant,
}: {
  rows: UserRow[]; leaveRows: LeaveRow[]; year: number;
  selected: UserRow | null; onSelect: (id: string) => void;
  canManage: boolean; onGrant: () => void; onCreate: () => void; onNotify: () => void; onBulkGrant: () => void;
}) {
  const router = useRouter();
  const workers = rows.filter((r) => r.role === 'WORKER');
  const pendingCount = leaveRows.filter((r) => r.status === 'PENDING').length;
  const [approveTarget, setApproveTarget] = useState<LeaveRow | null>(null);
  const [actorSignature, setActorSignature] = useState<{ url: string; ref: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /* 결재자 본인 active 서명 미리 조회 (모달 자동 노출) */
  useEffect(() => {
    if (!approveTarget) return;
    fetch('/api/users/me/signature').then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setActorSignature(d.signatureUrl ? { url: d.signatureUrl, ref: d.signatureRef } : null);
      } else setActorSignature(null);
    }).catch(() => setActorSignature(null));
  }, [approveTarget]);

  async function decide(id: string, action: 'APPROVE' | 'REJECT', payload: { signature?: string; useStoredSignature?: boolean; comment?: string } = {}) {
    setBusy(true);
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    setBusy(false);
    if (res.ok) {
      setApproveTarget(null);
      router.refresh();
    } else {
      alert('실패: ' + (await res.json().catch(() => ({}))).error);
    }
  }

  const [certForId, setCertForId] = useState<string | null>(null);

  const zeroBalanceCount = workers.filter((w) => w.thisYearRemaining <= 0).length;

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title={`${year}년 부여 합계`} value={workers.reduce((s, w) => s + w.thisYearGranted, 0).toFixed(1)} unit="일" />
        <SummaryCard title={`${year}년 사용 합계`} value={workers.reduce((s, w) => s + w.thisYearUsed, 0).toFixed(1)} unit="일" tone="accent" />
        <SummaryCard title="잔여 합계" value={workers.reduce((s, w) => s + w.thisYearRemaining, 0).toFixed(1)} unit="일" tone="success" />
        <SummaryCard title="대기 신청" value={String(pendingCount)} unit="건" tone="warning" />
      </div>

      {/* 잔여 0 알림 영역 */}
      {canManage && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${zeroBalanceCount > 0 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
          <span className="text-lg">{zeroBalanceCount > 0 ? '⚠' : '✓'}</span>
          <div className="text-xs font-bold flex-1">
            <span className={zeroBalanceCount > 0 ? 'text-amber-800' : 'text-emerald-700'}>
              {zeroBalanceCount > 0
                ? `잔여 0 또는 미부여 워커 ${zeroBalanceCount}명 — 월초 부여를 검토하세요.`
                : '모든 워커가 연차 잔여를 보유하고 있습니다.'}
            </span>
          </div>
          <button onClick={onNotify}
            className="px-3 py-1.5 rounded-md text-[0.6875rem] font-extrabold bg-accent text-white hover:bg-accent-strong">
            알림 발송 / 미리보기
          </button>
        </div>
      )}

      {/* 사용자 요청 2026-04-29: 좌우 grid → 상하 스택. 휴가 신청 내역 상단, 직원별 연차 하단. */}
      <div className="space-y-4">
        {/* 상단 — 휴가 신청 목록 */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-line flex items-center gap-2">
            <span className="text-xs font-extrabold text-ink">휴가 신청 내역</span>
            {selected && <span className="text-[0.625rem] font-mono text-slate-600">선택: {selected.name}</span>}
            <button onClick={onCreate} disabled={!selected}
              className="ml-auto px-2.5 py-1 rounded text-[0.625rem] font-extrabold bg-accent text-white disabled:opacity-40">
              + 휴가 신청
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">근로자</th>
                <th className="px-3 py-2 text-left">유형</th>
                <th className="px-3 py-2 text-left">기간</th>
                <th className="px-3 py-2 text-left">사유</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">결재자 서명</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leaveRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">신청 내역이 없습니다.</td></tr>
              )}
              {leaveRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-bold text-ink text-sm">{r.workerName}</div>
                    <div className="text-[0.625rem] font-mono text-slate-600">{r.employeeNo ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs font-bold">{LEAVE_TYPE_LABEL[r.requestType] ?? r.requestType}</td>
                  <td className="px-3 py-2 font-mono text-[0.6875rem]">
                    {r.startDate}<br />~ {r.endDate}
                    <div className="text-[0.5625rem] text-slate-500">{daysBetween(r.startDate, r.endDate)}일</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate" title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                  <td className="px-3 py-2"><LeaveStatusBadge status={r.status} /></td>
                  <td className="px-3 py-2">
                    {r.approverSignatureUrl ? (
                      <button onClick={() => setCertForId(r.id)} className="flex items-center gap-1.5 hover:bg-slate-100 rounded px-1 py-0.5 transition" title="결재 인증서 보기">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.approverSignatureUrl} alt="signature" className="h-[40px] w-[80px] object-contain bg-white border border-line rounded" />
                        <div className="text-left">
                          <div className="text-[0.625rem] font-bold text-ink">{r.approverName}</div>
                          <div className="text-[0.5625rem] font-mono text-slate-600">{r.approverSignatureRef?.slice(0, 8)}</div>
                        </div>
                      </button>
                    ) : <span className="text-[0.625rem] font-mono text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(r.status === 'PENDING' || r.status === 'IN_REVIEW') && canManage && (
                      <button onClick={() => setApproveTarget(r)} className="text-xs font-bold text-accent hover:underline">
                        {r.status === 'PENDING' ? '1차 결재' : '대표 결재'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* 하단 — 직원별 연차 (사용자 요청 2026-04-29: 위에서 아래로 이동, full width) */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-line flex items-center gap-1">
            <span className="text-xs font-extrabold text-ink">{year}년 직원별 연차</span>
            {canManage && (
              <>
                <button onClick={onBulkGrant}
                  className="ml-auto px-2.5 py-1 rounded text-[0.625rem] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
                  일괄 부여
                </button>
                <button onClick={onGrant} disabled={!selected}
                  className="px-2.5 py-1 rounded text-[0.625rem] font-extrabold bg-accent text-white disabled:opacity-40">
                  개인 부여
                </button>
              </>
            )}
          </div>
          {/* 사용자 요청 2026-04-29: 이름 1단계 다운 (text-sm → text-xs),
              Stat 내용 글자 2단계 업 (text-[0.625rem] → text-sm), 식별성 향상. */}
          <div className="max-h-[560px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
            {workers.map((w) => (
              <button key={w.id} onClick={() => onSelect(w.id)}
                className={`w-full text-left px-3 py-2 border-b border-r border-line hover:bg-slate-50 ${selected?.id === w.id ? 'bg-accent-soft border-l-[3px] border-l-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-xs">{w.name}</span>
                  <span className="text-[0.625rem] font-mono font-extrabold text-slate-600">{w.employeeNo ?? '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-sm font-mono">
                  <Stat label="부여" value={w.thisYearGranted.toFixed(1)} />
                  <Stat label="사용" value={w.thisYearUsed.toFixed(1)} tone="accent" />
                  <Stat label="잔여" value={w.thisYearRemaining.toFixed(1)} tone={w.thisYearRemaining > 0 ? 'success' : 'warning'} />
                </div>
                <div className="text-[0.5625rem] font-mono text-slate-500 mt-1">권장 {w.recommendDays}일 · 근속 {w.tenureYears}년</div>
              </button>
            ))}
            {workers.length === 0 && <div className="col-span-full px-3 py-10 text-center text-slate-500 text-sm">근로자가 없습니다.</div>}
          </div>
        </div>
      </div>

      {approveTarget && (
        <ApprovalSignatureModal
          title="휴가 결재"
          subtitle={`${approveTarget.workerName} · ${LEAVE_TYPE_LABEL[approveTarget.requestType] ?? approveTarget.requestType}`}
          preview={
            <div className="space-y-1">
              <div><span className="font-bold">기간:</span> {approveTarget.startDate} ~ {approveTarget.endDate} ({daysBetween(approveTarget.startDate, approveTarget.endDate)}일)</div>
              {approveTarget.reason && <div><span className="font-bold">사유:</span> {approveTarget.reason}</div>}
            </div>
          }
          busy={busy}
          storedSignatureUrl={actorSignature?.url ?? null}
          storedSignatureRef={actorSignature?.ref ?? null}
          onClose={() => setApproveTarget(null)}
          onApprove={(p) => decide(approveTarget.id, 'APPROVE', p)}
          onReject={(p) => decide(approveTarget.id, 'REJECT', p)}
        />
      )}

      {certForId && <ApprovalCertModal leaveRequestId={certForId} onClose={() => setCertForId(null)} />}
    </div>
  );
}

/* ────────────────────────  탭 4: 휴가 캘린더  ──────────────────────── */
function CalendarTab() {
  const todayYm = new Date().toISOString().slice(0, 7);
  const [ym, setYm] = useState(todayYm);
  const [data, setData] = useState<{
    items: Array<{ id: string; workerName: string; requestType: string; startDate: string; endDate: string; status: string; employeeNo: string | null }>;
    dayMap: Record<string, { approved: number; pending: number; rejected: number; types: string[]; workers: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leave-requests/calendar?ym=${ym}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ items: [], dayMap: {} }))
      .finally(() => setLoading(false));
  }, [ym]);

  const [year, month] = ym.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const startWeekday = firstDay.getUTCDay();
  const totalDays = lastDay.getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function changeMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYm(d.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50">◀</button>
        <h3 className="text-xl font-extrabold text-ink">{year}년 {month}월</h3>
        <button onClick={() => changeMonth(1)} className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50">▶</button>
        <button onClick={() => setYm(todayYm)} className="px-3 py-1.5 rounded border border-line bg-white text-sm font-bold hover:bg-slate-50">오늘</button>
        {loading && <span className="text-xs font-mono text-slate-600 ml-3">로딩 중…</span>}
        <div className="ml-auto flex items-center gap-3 text-[0.6875rem] font-bold">
          <LegendDot color="bg-emerald-500" label="승인" />
          <LegendDot color="bg-amber-400" label="대기" />
          <LegendDot color="bg-slate-300" label="반려" />
        </div>
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard title={`${month}월 신청`} value={String(data.items.length)} unit="건" />
          <SummaryCard title="승인" value={String(data.items.filter((i) => i.status === 'APPROVED').length)} unit="건" tone="success" />
          <SummaryCard title="대기" value={String(data.items.filter((i) => i.status === 'PENDING').length)} unit="건" tone="warning" />
          <SummaryCard title="반려" value={String(data.items.filter((i) => i.status === 'REJECTED').length)} unit="건" />
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-slate-100 border-b-2 border-line">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`px-2 py-2 text-center text-[0.6875rem] font-mono font-extrabold ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-600'}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((dayKey, i) => {
            if (!dayKey) {
              return <div key={i} className="h-[100px] bg-slate-50/50 border-b border-r border-line" />;
            }
            const day = Number(dayKey.slice(8, 10));
            const weekday = (i % 7);
            const info = data?.dayMap[dayKey];
            const isToday = dayKey === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={i}
                onMouseEnter={() => setHover(dayKey)}
                onMouseLeave={() => setHover(null)}
                className={`h-[100px] border-b border-r border-line p-1.5 relative ${isToday ? 'bg-accent-soft' : ''} hover:bg-slate-50 cursor-default`}
              >
                <div className={`text-xs font-mono font-extrabold mb-1 ${weekday === 0 ? 'text-red-600' : weekday === 6 ? 'text-blue-600' : 'text-ink'}`}>
                  {day}
                </div>
                {info && (
                  <div className="space-y-0.5">
                    {/* 신청자 이름 chip 직접 표시 (최대 3명, 초과는 +N) */}
                    {info.workers.slice(0, 3).map((wn, idx) => (
                      <div key={idx}
                        className={`text-[0.625rem] font-extrabold px-1 py-0.5 rounded truncate border ${
                          info.approved > 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          info.pending > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-slate-200 text-slate-700 border-slate-400'
                        }`}>
                        {wn}
                      </div>
                    ))}
                    {info.workers.length > 3 && (
                      <div className="text-[0.5625rem] font-mono font-bold text-slate-600">+{info.workers.length - 3}명 더</div>
                    )}
                    <div className="flex gap-1 mt-0.5">
                      {info.approved > 0 && <span className="text-[0.5625rem] font-mono font-extrabold text-emerald-700">✓{info.approved}</span>}
                      {info.pending > 0 && <span className="text-[0.5625rem] font-mono font-extrabold text-amber-700">⏳{info.pending}</span>}
                      {info.rejected > 0 && <span className="text-[0.5625rem] font-mono font-extrabold text-slate-600">✗{info.rejected}</span>}
                    </div>
                  </div>
                )}
                {hover === dayKey && info && info.workers.length > 3 && (
                  <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 bg-slate-900 text-white px-2.5 py-1.5 rounded text-[0.625rem] font-bold shadow-lg whitespace-nowrap pointer-events-none">
                    {info.workers.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 월별 신청 리스트 */}
      {data && data.items.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-line text-xs font-extrabold text-ink">
            {month}월 신청 내역 ({data.items.length}건)
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">근로자</th>
                <th className="px-3 py-2 text-left">유형</th>
                <th className="px-3 py-2 text-left">기간</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5"><span className="font-bold text-sm">{r.workerName}</span> <span className="text-[0.625rem] font-mono text-slate-600">{r.employeeNo ?? '—'}</span></td>
                  <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded font-mono font-extrabold bg-accent-soft text-accent text-[0.625rem]">{LEAVE_TYPE_LABEL[r.requestType] ?? r.requestType}</span></td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.startDate} ~ {r.endDate}</td>
                  <td className="px-3 py-1.5"><LeaveStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

/* ────────────────────────  탭 6: 조직도  ──────────────────────── */
type OrgMember = { id: string; name: string; employeeNo: string | null; positionLabel: string | null; positionCategory: string | null; profilePhotoUrl: string | null };
type OrgNode = {
  id: string; name: string; parentId: string | null; sortOrder: number;
  head: { id: string; name: string; positionLabel: string | null } | null;
  members: OrgMember[];
  children: OrgNode[];
};

function OrgChartTab({ canManage, allUsers, positions }: { canManage: boolean; allUsers: UserRow[]; positions: PositionRow[] }) {
  const [data, setData] = useState<{ contractorName: string | null; tree: OrgNode[]; unassigned: OrgMember[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const router = useRouter();

  function load() {
    setLoading(true);
    fetch('/api/org-chart')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function setHead(deptId: string, headUserId: string | null) {
    const res = await fetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ headUserId }),
    });
    if (res.ok) { load(); router.refresh(); setEditDeptId(null); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  /* 사용자 요청 2026-04-29: 부서명 셋업 가능. PATCH /api/departments/[id] 의 name 필드 활용. */
  async function renameDept(deptId: string, newName: string) {
    if (!newName.trim()) { alert('부서명을 입력하세요'); return; }
    const res = await fetch(`/api/departments/${deptId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) { load(); router.refresh(); setEditDeptId(null); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  /* 신규 부서 생성 — POST /api/departments */
  async function createDept(name: string) {
    if (!name.trim()) { alert('부서명을 입력하세요'); return; }
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) { load(); router.refresh(); setAddingNew(false); setNewDeptName(''); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  /* 부서 삭제 (소속 사용자 0명일 때만 가능) — DELETE /api/departments/[id] */
  async function deleteDept(deptId: string, name: string) {
    if (!confirm(`'${name}' 부서를 삭제하시겠습니까? (소속 사용자가 있으면 거부됩니다)`)) return;
    const res = await fetch(`/api/departments/${deptId}`, { method: 'DELETE' });
    if (res.ok) { load(); router.refresh(); }
    else {
      const j = await res.json().catch(() => ({}));
      if (j.error === 'has_dependents') alert(`삭제 불가: 소속 ${j.users}명 / 하위부서 ${j.children}개`);
      else alert('실패: ' + (j.error ?? ''));
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-500">조직도 로딩 중…</div>;
  if (!data) return <div className="text-center py-12 text-red-600">조직도 로딩 실패</div>;

  const totalMembers = countMembers(data.tree) + data.unassigned.length;

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <h3 className="text-lg font-extrabold text-ink">{data.contractorName ?? '조직도'}</h3>
        <span className="text-xs font-mono font-bold text-slate-600">총 {totalMembers}명 / {data.tree.length}개 본부</span>
        {canManage && (
          <button onClick={() => setAddingNew((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-md text-xs font-extrabold bg-accent text-white hover:bg-cyan-800">
            {addingNew ? '취소' : '+ 부서 등록'}
          </button>
        )}
      </div>

      {addingNew && canManage && (
        <div className="bg-cyan-50 border-2 border-accent rounded-lg p-4 flex items-center gap-2">
          <input type="text" autoFocus value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createDept(newDeptName); if (e.key === 'Escape') { setAddingNew(false); setNewDeptName(''); } }}
            placeholder="새 부서명 (예: 안전환경팀)"
            className="flex-1 px-3 py-2 rounded-md border-2 border-accent bg-white text-sm font-bold focus:outline-none" />
          <button onClick={() => createDept(newDeptName)}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800">
            저장
          </button>
        </div>
      )}

      {/* 사용자 요청 2026-04-29: 직책 관리 패널을 부서 등록 바로 밑으로 이동. 부서 트리 위에 위치. */}
      <PositionPanel positions={positions} canManage={canManage} />

      {data.tree.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-10 text-center text-slate-500">
          부서가 없습니다. {canManage ? '상단의 [+ 부서 등록] 버튼으로 등록하세요.' : '관리자에게 문의하세요.'}
        </div>
      ) : (
        <div className="space-y-3">
          {data.tree.map((node) => (
            <OrgDeptCard key={node.id} node={node} depth={0} canManage={canManage} allUsers={allUsers}
              editDeptId={editDeptId} setEditDeptId={setEditDeptId}
              setHead={setHead} renameDept={renameDept} deleteDept={deleteDept} />
          ))}
        </div>
      )}

      {data.unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-100 text-xs font-extrabold text-amber-800">
            ⚠ 부서 미지정 ({data.unassigned.length}명)
          </div>
          <div className="p-3 grid grid-cols-4 gap-2">
            {data.unassigned.map((m) => <OrgMemberCard key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── 직책 관리 패널 (조직도 탭 내) ─────────────── */
function PositionPanel({ positions, canManage }: { positions: PositionRow[]; canManage: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  /* 사용자 피드백 2026-04-29: 직책 등록 시 code 입력 요구 → 자동 생성으로 변경.
     코드는 'POS_' + 타임스탬프 base36 6자 (대문자) — 사용자는 이름/카테고리만 입력. */
  const [newPos, setNewPos] = useState({ label: '', category: 'OFFICE' as 'OFFICE' | 'FIELD' | 'OTHER' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  /* 사용자 피드백 2026-04-29 v2: 코드 충돌 회피 강화 — base36 ts 8자 + random 4자.
     예: POS_LRPL5BG0_A3F7 (12자 suffix). 같은 ms 내 다중 등록도 충돌 거의 0. */
  function generateCode(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `POS_${ts}_${rnd}`;
  }

  /* 사용자 피드백 2026-04-29: 1건 등록 후 폼이 닫히는 문제 → 폼 유지하여 연속 등록 지원.
     label 만 초기화, 카테고리는 유지 (같은 카테고리 연속 등록 편의). */
  async function createPos() {
    if (!newPos.label.trim()) { alert('직책명을 입력하세요'); return; }
    const code = generateCode();
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, label: newPos.label.trim(), category: newPos.category }),
    });
    if (res.ok) {
      /* 폼 유지 — label 만 초기화하여 다음 등록 즉시 가능 */
      setNewPos((prev) => ({ ...prev, label: '' }));
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(`실패: ${j.error === 'duplicate_code' ? '동일 코드 충돌 (잠시 후 다시 시도)' : (j.error ?? '')}`);
    }
  }

  async function renamePos(id: string, label: string) {
    if (!label.trim()) { alert('직책명을 입력하세요'); return; }
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: label.trim() }),
    });
    if (res.ok) { setEditingId(null); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  async function toggleActive(id: string, currentActive: boolean) {
    if (currentActive && !confirm('이 직책을 비활성화하시겠습니까? (등록된 사용자는 유지)')) return;
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !currentActive }),
    });
    if (res.ok) router.refresh();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  const byCat: Record<string, PositionRow[]> = { OFFICE: [], FIELD: [], OTHER: [] };
  for (const p of positions) (byCat[p.category] ?? byCat.OTHER).push(p);

  const CAT_LABEL: Record<string, string> = { OFFICE: '사무직 (관리직)', FIELD: '현장직 (기술직/현장관리)', OTHER: '기타 (간접인력)' };

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line bg-slate-100 flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-extrabold text-ink">🏷 직책 관리</h3>
        <span className="text-[0.6875rem] font-mono text-slate-600">활성 {positions.length}건 · 사용자 등록 dropdown 에 자동 반영</span>
        <span className="text-[0.625rem] font-bold text-amber-700">⚠ Position 은 전역 — 변경 시 모든 회사 영향</span>
        {canManage && (
          <button onClick={() => setAdding((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-md text-xs font-extrabold bg-accent text-white hover:bg-cyan-800">
            {adding ? '취소' : '+ 직책 등록'}
          </button>
        )}
      </div>

      {adding && canManage && (
        <div className="px-4 py-3 border-b border-line bg-cyan-50 flex flex-wrap items-center gap-2">
          {/* 사용자 피드백 2026-04-29: code 입력 제거, 자동 생성. 이름/카테고리만 입력. */}
          <input type="text" autoFocus placeholder="직책명 (예: 팀장)" value={newPos.label}
            onChange={(e) => setNewPos({ ...newPos, label: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') createPos(); if (e.key === 'Escape') { setAdding(false); setNewPos({ label: '', category: 'OFFICE' }); } }}
            className="flex-1 min-w-[160px] px-3 py-2 rounded-md border-2 border-accent bg-white text-sm font-bold focus:outline-none" />
          <select value={newPos.category}
            onChange={(e) => setNewPos({ ...newPos, category: e.target.value as 'OFFICE' | 'FIELD' | 'OTHER' })}
            className="px-3 py-2 rounded-md border-2 border-accent text-sm font-bold bg-white focus:outline-none">
            <option value="OFFICE">사무직</option>
            <option value="FIELD">현장직</option>
            <option value="OTHER">기타</option>
          </select>
          <button onClick={createPos}
            className="px-4 py-2 rounded-md text-sm font-extrabold bg-accent text-white hover:bg-cyan-800">저장</button>
          <span className="text-[0.625rem] font-mono text-slate-500">code 자동 생성</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-line">
        {(['OFFICE', 'FIELD', 'OTHER'] as const).map((cat) => (
          <div key={cat} className="p-3">
            <div className="text-[0.6875rem] font-mono font-extrabold text-ink-muted mb-2 tracking-widest uppercase">{CAT_LABEL[cat]}</div>
            <div className="space-y-1">
              {byCat[cat].length === 0 && <div className="text-[0.6875rem] text-slate-500 py-2">— 등록된 직책 없음</div>}
              {byCat[cat].map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-line bg-white">
                  <code className="text-[0.625rem] font-mono text-slate-500 w-[80px] truncate" title={p.code}>{p.code}</code>
                  {editingId === p.id ? (
                    <>
                      <input type="text" autoFocus value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renamePos(p.id, labelDraft);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-2 py-0.5 rounded border-2 border-accent text-xs font-bold focus:outline-none" />
                      <button onClick={() => renamePos(p.id, labelDraft)}
                        className="text-[0.625rem] font-extrabold text-accent hover:underline">저장</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-[0.625rem] font-bold text-slate-500 hover:underline">취소</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-bold text-ink truncate">{p.label}</span>
                      {canManage && (
                        <>
                          <button onClick={() => { setLabelDraft(p.label); setEditingId(p.id); }}
                            title="이름 수정" className="text-[0.625rem] text-slate-500 hover:text-accent">✎</button>
                          <button onClick={() => toggleActive(p.id, true)}
                            title="비활성화" className="text-[0.625rem] text-slate-500 hover:text-red-600">×</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function countMembers(nodes: OrgNode[]): number {
  return nodes.reduce((s, n) => s + n.members.length + countMembers(n.children), 0);
}

function OrgDeptCard({
  node, depth, canManage, allUsers, editDeptId, setEditDeptId, setHead, renameDept, deleteDept,
}: {
  node: OrgNode; depth: number; canManage: boolean; allUsers: UserRow[];
  editDeptId: string | null; setEditDeptId: (id: string | null) => void;
  setHead: (deptId: string, userId: string | null) => Promise<void>;
  renameDept: (deptId: string, name: string) => Promise<void>;
  deleteDept: (deptId: string, name: string) => Promise<void>;
}) {
  const isEditing = editDeptId === node.id;
  const isRenaming = editDeptId === `rename:${node.id}`;
  const [nameDraft, setNameDraft] = useState(node.name);
  const candidateUsers = allUsers.filter((u) => u.department?.id === node.id || u.id === node.head?.id);
  /* 부서장 후보: 해당 부서 소속자 또는 OFFICE 라인 누구나 */
  const broaderCandidates = allUsers.filter((u) => u.position?.category === 'OFFICE' || u.department?.id === node.id);
  const canDelete = node.members.length === 0 && node.children.length === 0;

  return (
    <div className="bg-surface border border-line rounded-lg shadow-sm" style={{ marginLeft: depth * 24 }}>
      <div className="px-4 py-2.5 border-b border-line bg-slate-100 flex items-center gap-3 flex-wrap">
        {/* 부서명 — 편집 모드 / 표시 모드 (사용자 요청 2026-04-29) */}
        {isRenaming && canManage ? (
          <>
            <span className="text-sm font-extrabold text-ink">📁</span>
            <input type="text" autoFocus value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameDept(node.id, nameDraft);
                if (e.key === 'Escape') { setEditDeptId(null); setNameDraft(node.name); }
              }}
              className="px-2 py-1 rounded border-2 border-accent bg-white text-sm font-bold focus:outline-none w-[200px]" />
            <button onClick={() => renameDept(node.id, nameDraft)}
              className="text-[0.6875rem] font-extrabold text-accent hover:underline">저장</button>
            <button onClick={() => { setEditDeptId(null); setNameDraft(node.name); }}
              className="text-[0.6875rem] font-bold text-slate-600 hover:underline">취소</button>
          </>
        ) : (
          <>
            <div className="text-sm font-extrabold text-ink">📁 {node.name}</div>
            {canManage && (
              <button onClick={() => { setNameDraft(node.name); setEditDeptId(`rename:${node.id}`); }}
                title="부서명 수정"
                className="text-[0.625rem] font-bold text-slate-500 hover:text-accent">✎</button>
            )}
          </>
        )}
        <div className="text-[0.625rem] font-mono text-slate-600">{node.members.length}명</div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {node.head ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-100 border border-purple-300">
              <span className="text-[0.625rem] font-mono font-extrabold text-purple-700">부서장</span>
              <span className="text-xs font-bold text-purple-800">{node.head.name}</span>
              {node.head.positionLabel && <span className="text-[0.625rem] font-mono text-purple-600">({node.head.positionLabel})</span>}
            </div>
          ) : (
            <span className="text-[0.625rem] font-mono text-slate-500">부서장 미지정</span>
          )}
          {canManage && (
            <button onClick={() => setEditDeptId(isEditing ? null : node.id)}
              className="text-[0.625rem] font-bold text-accent hover:underline">
              {isEditing ? '닫기' : '부서장 변경'}
            </button>
          )}
          {canManage && canDelete && (
            <button onClick={() => deleteDept(node.id, node.name)}
              className="text-[0.625rem] font-bold text-red-600 hover:underline">
              부서 삭제
            </button>
          )}
        </div>
      </div>

      {isEditing && canManage && (
        <div className="px-4 py-2 border-b border-line bg-amber-50 flex items-center gap-2">
          <span className="text-[0.6875rem] font-mono font-bold text-slate-600">부서장 선택:</span>
          <select onChange={(e) => setHead(node.id, e.target.value || null)}
            defaultValue={node.head?.id ?? ''}
            className="px-2 py-1 rounded border border-line bg-white text-xs font-bold">
            <option value="">— 미지정 —</option>
            <optgroup label="해당 부서원">
              {candidateUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.position?.label ?? '직책 미지정'})</option>
              ))}
            </optgroup>
            <optgroup label="기타 (사무직)">
              {broaderCandidates.filter((u) => !candidateUsers.find((c) => c.id === u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.position?.label ?? '직책 미지정'})</option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {node.members.length > 0 && (
        <div className="p-3 grid grid-cols-4 gap-2">
          {node.members.map((m) => <OrgMemberCard key={m.id} m={m} isHead={m.id === node.head?.id} />)}
        </div>
      )}

      {node.children.length > 0 && (
        <div className="p-2 space-y-2 border-t border-line">
          {node.children.map((c) => (
            <OrgDeptCard key={c.id} node={c} depth={depth + 1} canManage={canManage} allUsers={allUsers}
              editDeptId={editDeptId} setEditDeptId={setEditDeptId}
              setHead={setHead} renameDept={renameDept} deleteDept={deleteDept} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgMemberCard({ m, isHead }: { m: OrgMember; isHead?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded border ${isHead ? 'border-purple-300 bg-purple-50' : 'border-line bg-white'}`}>
      <Avatar url={m.profilePhotoUrl} name={m.name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-extrabold text-ink truncate">{m.name}</span>
          {isHead && <span className="text-[0.5rem] font-mono font-extrabold text-purple-700">★</span>}
        </div>
        <div className="text-[0.625rem] font-mono text-slate-600 truncate">
          {m.employeeNo ?? '—'} · {m.positionLabel ?? '직책 X'}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────  탭 5: 휴가 보고서  ──────────────────────── */
type ReportData = {
  range: { from: string; to: string };
  total: { requested: number; approved: number; inReview: number; rejected: number };
  totalDays: { requested: number; approved: number; annualUsed: number };
  byType: Record<string, { count: number; days: number }>;
  byStatus: Record<string, number>;
  byWorker: Array<{ workerId: string; workerName: string; employeeNo: string | null; count: number; days: number }>;
  byDepartment: Array<{ departmentName: string; count: number; days: number }>;
  byMonth: Array<{ ym: string; count: number; days: number }>;
  rows: Array<{
    id: string; workerName: string; workerEmployeeNo: string | null;
    departmentName: string | null; positionLabel: string | null;
    requestType: string; status: string; startDate: string; endDate: string; days: number;
    reason: string | null; firstApproverName: string | null; finalApproverName: string | null;
  }>;
};

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  return { from, to };
}

function ReportTab() {
  const [from, setFrom] = useState(defaultRange().from);
  const [to, setTo] = useState(defaultRange().to);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  function buildQuery(format?: 'xlsx' | 'csv') {
    const params = new URLSearchParams({ from, to });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (format) params.set('format', format);
    return params.toString();
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave-requests/stats?${buildQuery()}`);
      if (res.ok) setData(await res.json());
      else { setData(null); alert('실패: ' + (await res.json().catch(() => ({}))).error); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function quickRange(kind: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear') {
    const now = new Date();
    let f: Date, t: Date;
    if (kind === 'thisMonth') {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (kind === 'lastMonth') {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (kind === 'lastYear') {
      f = new Date(now.getFullYear() - 1, 0, 1);
      t = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      f = new Date(now.getFullYear(), 0, 1);
      t = new Date(now.getFullYear(), 11, 31);
    }
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  }

  const maxByType = Math.max(1, ...Object.values(data?.byType ?? {}).map((v) => v.days));
  const maxByMonth = Math.max(1, ...(data?.byMonth ?? []).map((m) => m.days));
  const maxByDept = Math.max(1, ...(data?.byDepartment ?? []).map((d) => d.days));

  return (
    <div className="space-y-4">
      {/* 필터 + 다운로드 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3">
        <Field label="시작일">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm" />
        </Field>
        <Field label="종료일">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm" />
        </Field>
        <Field label="유형">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">전체</option>
            {Object.entries(LEAVE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="상태">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">전체</option>
            {Object.entries(LEAVE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>

        <div className="flex items-end gap-1">
          <button onClick={() => quickRange('thisMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">이번 달</button>
          <button onClick={() => quickRange('lastMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">전월</button>
          <button onClick={() => quickRange('thisYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">올해</button>
          <button onClick={() => quickRange('lastYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">전년</button>
        </div>

        <button onClick={load} disabled={loading}
          className="ml-auto px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        <a href={`/api/leave-requests/export?${buildQuery('xlsx')}`}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          📊 엑셀 다운로드
        </a>
        <a href={`/api/leave-requests/export?${buildQuery('csv')}`}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-slate-700 text-white hover:bg-slate-800">
          📄 CSV
        </a>
      </div>

      {!data && <div className="text-center py-12 text-slate-500">조회 결과를 기다리는 중…</div>}

      {data && (
        <>
          {/* 요약 KPI */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard title="전체 신청" value={String(data.total.requested)} unit="건" />
            <SummaryCard title="결재 완료" value={String(data.total.approved)} unit="건" tone="success" />
            <SummaryCard title="결재 중" value={String(data.total.inReview)} unit="건" tone="warning" />
            <SummaryCard title="연차 사용" value={data.totalDays.annualUsed.toFixed(1)} unit="일" tone="accent" />
          </div>

          {/* 유형별 + 부서별 (좌 우) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-slate-100 text-xs font-extrabold text-ink">유형별 분포</div>
              <div className="p-3 space-y-1.5">
                {Object.entries(data.byType).sort((a, b) => b[1].days - a[1].days).map(([t, v]) => (
                  <BarRow key={t} label={LEAVE_TYPE_LABEL[t] ?? t} value={v.days} max={maxByType} suffix="일" sub={`${v.count}건`} />
                ))}
                {Object.keys(data.byType).length === 0 && <div className="text-xs text-slate-500 text-center py-4">데이터 없음</div>}
              </div>
            </div>

            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-slate-100 text-xs font-extrabold text-ink">부서별 분포</div>
              <div className="p-3 space-y-1.5">
                {data.byDepartment.map((d) => (
                  <BarRow key={d.departmentName} label={d.departmentName} value={d.days} max={maxByDept} suffix="일" sub={`${d.count}건`} color="bg-emerald-400" />
                ))}
                {data.byDepartment.length === 0 && <div className="text-xs text-slate-500 text-center py-4">데이터 없음</div>}
              </div>
            </div>
          </div>

          {/* 월별 추이 + 워커 Top */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-slate-100 text-xs font-extrabold text-ink">월별 추이</div>
              <div className="p-3 space-y-1.5">
                {data.byMonth.map((m) => (
                  <BarRow key={m.ym} label={m.ym} value={m.days} max={maxByMonth} suffix="일" sub={`${m.count}건`} color="bg-amber-400" />
                ))}
                {data.byMonth.length === 0 && <div className="text-xs text-slate-500 text-center py-4">데이터 없음</div>}
              </div>
            </div>

            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-slate-100 text-xs font-extrabold text-ink">작업자 Top 10</div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-600">
                  <tr><th className="px-3 py-1.5 text-left">근로자</th><th className="px-3 py-1.5 text-right">건수</th><th className="px-3 py-1.5 text-right">일수</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.byWorker.slice(0, 10).map((w) => (
                    <tr key={w.workerId} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5"><span className="font-bold">{w.workerName}</span> <span className="text-[0.625rem] font-mono text-slate-600">{w.employeeNo ?? '—'}</span></td>
                      <td className="px-3 py-1.5 text-right font-mono">{w.count}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold">{w.days}</td>
                    </tr>
                  ))}
                  {data.byWorker.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-xs text-slate-500 text-center">데이터 없음</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* 신청 내역 */}
          <div className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line bg-slate-100 text-xs font-extrabold text-ink">신청 내역 ({data.rows.length}건)</div>
            <div className="max-h-[500px] overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-[0.625rem] font-mono font-extrabold text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">근로자</th>
                    <th className="px-2 py-1.5 text-left">부서</th>
                    <th className="px-2 py-1.5 text-left">유형</th>
                    <th className="px-2 py-1.5 text-left">기간</th>
                    <th className="px-2 py-1.5 text-right">일수</th>
                    <th className="px-2 py-1.5 text-left">상태</th>
                    <th className="px-2 py-1.5 text-left">1차/대표</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5"><span className="font-bold text-sm">{r.workerName}</span> <span className="text-[0.625rem] font-mono text-slate-600">{r.workerEmployeeNo ?? '—'}</span></td>
                      <td className="px-2 py-1.5 text-xs">{r.departmentName ?? '—'}</td>
                      <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 rounded font-mono font-extrabold bg-accent-soft text-accent text-[0.625rem]">{LEAVE_TYPE_LABEL[r.requestType] ?? r.requestType}</span></td>
                      <td className="px-2 py-1.5 font-mono text-[0.6875rem]">{r.startDate} ~ {r.endDate}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-extrabold">{r.days}</td>
                      <td className="px-2 py-1.5"><LeaveStatusBadge status={r.status} /></td>
                      <td className="px-2 py-1.5 text-[0.625rem] font-mono text-slate-600">
                        {r.firstApproverName ?? '—'} / <span className="text-purple-700 font-bold">{r.finalApproverName ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">기간 내 신청 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BarRow({ label, value, max, suffix, sub, color = 'bg-accent' }: {
  label: string; value: number; max: number; suffix: string; sub?: string; color?: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[100px] text-xs font-bold text-ink truncate">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-sm h-5 overflow-hidden">
        <div className={`h-full ${color} flex items-center justify-end pr-1.5 text-[0.625rem] font-mono font-extrabold text-white`} style={{ width: `${pct}%` }}>
          {value}{suffix}
        </div>
      </div>
      {sub && <div className="text-[0.625rem] font-mono text-slate-600 w-[40px] text-right">{sub}</div>}
    </div>
  );
}

/* 결재 인증서 모달 — /api/leave-requests/[id]/signature */
type ApprovalSerialized = {
  action: string;
  actorName: string;
  actorRole: string;
  delegatedFromName: string | null;
  delegatedFromRole: string | null;
  signedAt: string;
  signatureRef: string | null;
  signatureUrl: string | null;
  ipAddress: string | null;
  comment: string | null;
};

function ApprovalCertModal({ leaveRequestId, onClose }: { leaveRequestId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    leaveRequest?: { id: string; requestType: string; startDate: string; endDate: string; status: string };
    worker?: { id: string; name: string; employeeNo: string | null };
    firstApproval?: ApprovalSerialized | null;
    finalApproval?: ApprovalSerialized | null;
    finalApproverPosition?: { code: string; label: string } | null;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/leave-requests/${leaveRequestId}/signature`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: 'load_failed' }));
  }, [leaveRequestId]);

  return (
    <Modal title="결재 인증서" onClose={onClose}>
      {data === null && <div className="text-center text-slate-500 py-6 text-sm">불러오는 중…</div>}
      {data?.error && <div className="text-center text-red-600 py-6 text-sm font-bold">{data.error}</div>}
      {(data?.firstApproval || data?.finalApproval) && data.worker && data.leaveRequest && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><div className="text-[0.625rem] font-mono text-slate-600">신청자</div><div className="font-bold">{data.worker.name} ({data.worker.employeeNo ?? '—'})</div></div>
            <div><div className="text-[0.625rem] font-mono text-slate-600">유형</div><div className="font-bold">{LEAVE_TYPE_LABEL[data.leaveRequest.requestType] ?? data.leaveRequest.requestType}</div></div>
            <div><div className="text-[0.625rem] font-mono text-slate-600">기간</div><div className="font-mono">{data.leaveRequest.startDate} ~ {data.leaveRequest.endDate}</div></div>
            <div><div className="text-[0.625rem] font-mono text-slate-600">상태</div><div><LeaveStatusBadge status={data.leaveRequest.status} /></div></div>
          </div>

          <ApprovalBlock title="1차 결재" approval={data.firstApproval ?? null} pendingLabel="1차 결재 대기" />
          <ApprovalBlock
            title="대표 최종 결재"
            approval={data.finalApproval ?? null}
            pendingLabel="대표 결재 대기"
            badge={data.finalApproverPosition?.code === 'CEO' ? '✓ 대표' : null}
          />
        </div>
      )}
    </Modal>
  );
}

function ApprovalBlock({ title, approval, pendingLabel, badge }: {
  title: string;
  approval: ApprovalSerialized | null;
  pendingLabel: string;
  badge?: string | null;
}) {
  if (!approval) {
    return (
      <div className="border-t border-line pt-3">
        <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">{title}</div>
        <div className="text-amber-700 bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs font-bold">
          ⏳ {pendingLabel}
        </div>
      </div>
    );
  }
  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[0.625rem] font-mono font-extrabold text-slate-600">{title}</div>
        {badge && <span className="text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border bg-purple-100 text-purple-700 border-purple-300">{badge}</span>}
      </div>
      <div className="font-bold text-sm">{approval.actorName} <span className="text-[0.625rem] font-mono text-slate-600">({approval.actorRole})</span></div>
      {approval.delegatedFromName && (
        <div className="mt-1 text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1">
          ⚖ 대결 — 원 결재자: {approval.delegatedFromName} ({approval.delegatedFromRole})
        </div>
      )}
      <div className="font-mono text-[0.6875rem] text-slate-600 mt-0.5">{new Date(approval.signedAt).toLocaleString('ko-KR')}</div>
      <div className="font-mono text-[0.625rem] text-slate-600">IP: {approval.ipAddress ?? '—'}</div>
      <div className="font-mono text-[0.625rem] text-emerald-700 mt-1">ref: {approval.signatureRef}</div>
      {approval.comment && <div className="text-[0.6875rem] text-slate-700 italic mt-1">"{approval.comment}"</div>}
      {approval.signatureUrl && (
        <div className="border-2 border-accent rounded-lg p-2 bg-white flex items-center justify-center mt-2" style={{ minHeight: 100 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={approval.signatureUrl} alt="signature" className="max-h-[120px] max-w-full" />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────  Modals  ──────────────────────── */
function CreateUserModal({ onClose, canPickContractor, positions, departments, sessionRole }: {
  onClose: () => void; canPickContractor: boolean;
  positions: PositionRow[]; departments: DepartmentRow[];
  sessionRole: string;
}) {
  const isSuper = sessionRole === 'SUPER_ADMIN';
  const [form, setForm] = useState({
    username: '', password: '', name: '', role: 'WORKER',
    contractorId: '', phone: '', employeeNo: '',
    birthDate: '', hireDate: '', address: '',
    positionCode: '', departmentId: '',
    rank: '', primaryFacilityId: '',  /* AVAC 보강 */
  });
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  useEffect(() => {
    fetch('/api/super-admin/facilities?active=true')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setFacilities((j.items ?? []).map((f: { id: string; name: string; type: string }) => ({ id: f.id, name: f.name, type: f.type }))))
      .catch(() => setFacilities([]));
  }, []);
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [consentPII, setConsentPII] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit() {
    if (!form.username || !form.password || !form.name) { alert('아이디·비밀번호·이름은 필수'); return; }
    if (photo && !consentPII) { alert('사진 등록 시 개인정보 수집 동의가 필요합니다.'); return; }
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!canPickContractor) delete payload.contractorId;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });
    if (photo) { payload.profilePhoto = photo; payload.consentPII = true; }
    if (signature) payload.signature = signature;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { alert('등록되었습니다.'); onClose(); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <Modal title="신규 사용자 등록" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="아이디 *"><Input value={form.username} onChange={(v) => setForm({ ...form, username: v })} placeholder="영문/숫자/-/_" /></Field>
        <Field label="비밀번호 *"><Input type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="6자 이상" /></Field>
        <Field label="이름 *"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
        <Field label="권한 *">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="WORKER">근로자</option>
            <option value="INTERNAL_ADMIN">프로그램관리자</option>
            <option value="CONTRACTOR_ADMIN">대표</option>
            <option value="MUNI_ADMIN">지자체관리자</option>
            {isSuper && <option value="SUPER_ADMIN">슈퍼관리자</option>}
          </select>
        </Field>

        <div className="col-span-2 mt-2 text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest">직무</div>
        <Field label="직책">
          <select value={form.positionCode} onChange={(e) => setForm({ ...form, positionCode: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">미지정</option>
            <PositionOptGroup positions={positions} category="OFFICE" />
            <PositionOptGroup positions={positions} category="FIELD" />
            <PositionOptGroup positions={positions} category="OTHER" />
          </select>
        </Field>
        <Field label="부서">
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">미지정</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>

        {/* AVAC 보강 (Hot-fix 2026-05-02) */}
        <Field label="직급">
          <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">미지정</option>
            <optgroup label="엔지니어링">
              {RANK_OPTIONS.filter((r) => r.group === '엔지니어링').map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="숙련">
              {RANK_OPTIONS.filter((r) => r.group === '숙련').map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="단순노무">
              {RANK_OPTIONS.filter((r) => r.group === '단순노무').map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="주근무지(시설)">
          <select value={form.primaryFacilityId} onChange={(e) => setForm({ ...form, primaryFacilityId: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <option value="">미배치</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.type === 'AVAC' ? '🏭 ' : ''}{f.name}</option>
            ))}
          </select>
        </Field>

        <Field label="사번"><Input value={form.employeeNo} onChange={(v) => setForm({ ...form, employeeNo: v })} /></Field>
        <Field label="전화"><Input type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="010-1234-5678" /></Field>
        <Field label="생년월일"><Input type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} /></Field>
        <Field label="입사일"><Input type="date" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} /></Field>
        <Field label="주소" colSpan={2}><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>

        <div className="col-span-2 mt-2 text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest">자료 등록 (선택)</div>
        <Field label="프로필 사진" colSpan={2}>
          <ProfilePhotoUploader onChange={setPhoto} size={64} />
          {photo && (
            <label className="flex items-center gap-2 mt-2 text-[0.6875rem] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1">
              <input type="checkbox" checked={consentPII} onChange={(e) => setConsentPII(e.target.checked)} />
              개인정보(사진) 수집·이용 동의 (필수)
            </label>
          )}
        </Field>
        <Field label="서명" colSpan={2}>
          <SignaturePad onChange={setSignature} height={100} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
        <button disabled={saving} onClick={submit} className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
          {saving ? '등록 중…' : '등록'}
        </button>
      </div>
    </Modal>
  );
}

function GrantLeaveModal({ user, year, onClose }: { user: UserRow; year: number; onClose: () => void }) {
  const [form, setForm] = useState({
    year,
    granted: user.recommendDays || 15,
    carriedOver: user.thisYearCarriedOver || 0,
    note: user.recommendRule,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit() {
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}/leave-balance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { alert('연차 부여 완료'); onClose(); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <Modal title={`${user.name} - 연차 부여 (${year}년)`} onClose={onClose}>
      <div className="px-3 py-2 mb-3 rounded bg-accent-soft border border-accent text-xs font-bold text-accent">
        근속 {user.tenureYears}년 → 권장 부여일수: <span className="text-base">{user.recommendDays}일</span>
        <div className="text-[0.625rem] font-mono text-slate-600 mt-1">{user.recommendRule}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="대상 연도"><Input type="number" value={String(form.year)} onChange={(v) => setForm({ ...form, year: Number(v) })} /></Field>
        <Field label="부여일수"><Input type="number" value={String(form.granted)} onChange={(v) => setForm({ ...form, granted: Number(v) })} /></Field>
        <Field label="이월일수"><Input type="number" value={String(form.carriedOver)} onChange={(v) => setForm({ ...form, carriedOver: Number(v) })} /></Field>
        <Field label="비고" colSpan={2}><Input value={form.note} onChange={(v) => setForm({ ...form, note: v })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
        <button disabled={saving} onClick={submit} className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </Modal>
  );
}

function BulkGrantModal({ year, onClose }: { year: number; onClose: () => void }) {
  const [form, setForm] = useState({
    year,
    mode: 'all' as 'all' | 'role' | 'list',
    role: 'WORKER' as string,
    granted: 15,
    useRecommend: true,
    carriedOver: 0,
    note: '',
    overwrite: false,
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; granted: number; skipped: number; total: number; details?: Array<{ name: string; days: number; action: string; reason?: string }> } | null>(null);
  const router = useRouter();

  async function submit() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      year: form.year,
      mode: form.mode,
      useRecommend: form.useRecommend,
      carriedOver: form.carriedOver,
      overwrite: form.overwrite,
    };
    if (!form.useRecommend) payload.granted = form.granted;
    if (form.mode === 'role') payload.role = form.role;
    if (form.note) payload.note = form.note;

    const res = await fetch('/api/users/leave-balance/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    setResult(data);
    if (res.ok) router.refresh();
  }

  return (
    <Modal title={`${year}년 일괄 연차 부여`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="대상 연도">
          <Input type="number" value={String(form.year)} onChange={(v) => setForm({ ...form, year: Number(v) })} />
        </Field>

        <Field label="대상 범위">
          <div className="flex gap-2">
            <ModeBtn active={form.mode === 'all'} onClick={() => setForm({ ...form, mode: 'all' })}>전체 근로자</ModeBtn>
            <ModeBtn active={form.mode === 'role'} onClick={() => setForm({ ...form, mode: 'role' })}>특정 권한</ModeBtn>
          </div>
        </Field>

        {form.mode === 'role' && (
          <Field label="권한">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
              <option value="WORKER">근로자 (WORKER)</option>
              <option value="INTERNAL_ADMIN">내부관리자</option>
              <option value="CONTRACTOR_ADMIN">업체관리자</option>
            </select>
          </Field>
        )}

        <div className="border border-line rounded p-3 bg-slate-50 space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.useRecommend} onChange={(e) => setForm({ ...form, useRecommend: e.target.checked })} />
            권장 일수 자동 적용 (입사일 기반 근로기준법 §60)
          </label>
          {!form.useRecommend && (
            <Field label="고정 부여일수">
              <Input type="number" value={String(form.granted)} onChange={(v) => setForm({ ...form, granted: Number(v) })} />
            </Field>
          )}
        </div>

        <Field label="이월일수">
          <Input type="number" value={String(form.carriedOver)} onChange={(v) => setForm({ ...form, carriedOver: Number(v) })} />
        </Field>

        <Field label="비고 (선택)">
          <Input value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder="예: 2026년 정기 부여" />
        </Field>

        <label className="flex items-center gap-2 text-xs font-bold text-amber-700">
          <input type="checkbox" checked={form.overwrite} onChange={(e) => setForm({ ...form, overwrite: e.target.checked })} />
          ⚠ 기존 부여를 덮어쓰기 (overwrite)
        </label>

        {result && (
          <div className={`px-3 py-2 rounded border ${result.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'}`}>
            <div className="text-sm font-extrabold">결과: {result.granted}명 부여 / {result.skipped}명 스킵 / 전체 {result.total}명</div>
            {result.details && (
              <div className="mt-1 max-h-[150px] overflow-y-auto text-[0.625rem] font-mono">
                {result.details.slice(0, 30).map((d, i) => (
                  <div key={i}>
                    [{d.action}] {d.name}: {d.days}일{d.reason ? ` (${d.reason})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">닫기</button>
        <button disabled={saving} onClick={submit}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? '부여 중…' : '일괄 부여 실행'}
        </button>
      </div>
    </Modal>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 px-3 py-2 rounded text-xs font-extrabold border-2 transition ${
        active ? 'bg-accent text-white border-accent' : 'bg-white text-slate-600 border-line hover:border-accent'
      }`}
    >{children}</button>
  );
}

function CreateLeaveRequestModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [form, setForm] = useState({
    requestType: 'ANNUAL' as string,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const isHalf = form.requestType === 'ANNUAL_HALF';

  async function submit() {
    if (isHalf && form.startDate !== form.endDate) {
      alert('반차는 시작일과 종료일이 같아야 합니다.');
      return;
    }
    setSaving(true);
    const payload = isHalf ? { ...form, endDate: form.startDate } : form;
    const res = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workerId: user.id, ...payload }),
    });
    setSaving(false);
    if (res.ok) { alert('휴가 신청 등록'); onClose(); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  const days = isHalf
    ? 0.5
    : Math.max(1, Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86_400_000) + 1);

  return (
    <Modal title={`${user.name} - 휴가 신청`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="휴가 유형 *">
          <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })}
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm">
            <optgroup label="일반">
              {PRIMARY_LEAVE_TYPES.map((k) => <option key={k} value={k}>{LEAVE_TYPE_LABEL[k]}</option>)}
            </optgroup>
            <optgroup label="기타 (관리자용)">
              {SECONDARY_LEAVE_TYPES.map((k) => <option key={k} value={k}>{LEAVE_TYPE_LABEL[k]}</option>)}
            </optgroup>
          </select>
        </Field>
        <Field label="잔여 (연차/반차)">
          <div className="px-3 py-1.5 rounded bg-slate-100 text-sm font-mono font-extrabold">
            {user.thisYearRemaining.toFixed(1)}일
          </div>
        </Field>
        <Field label="시작일">
          <Input type="date" value={form.startDate}
            onChange={(v) => setForm({ ...form, startDate: v, endDate: isHalf ? v : form.endDate })} />
        </Field>
        <Field label={isHalf ? '종료일 (반차 = 시작일과 동일)' : '종료일'}>
          <Input type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
        </Field>
        <div className="col-span-2 px-3 py-2 rounded text-xs font-bold bg-accent-soft border border-accent text-accent">
          요청 일수: <span className="font-mono font-extrabold">{days}일</span>
          {isHalf && ' (반차 0.5일)'}
        </div>
        <Field label="사유" colSpan={2}>
          <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="간단한 사유를 입력하세요"
            className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">취소</button>
        <button disabled={saving} onClick={submit} className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white disabled:opacity-50">
          {saving ? '신청 중…' : '신청'}
        </button>
      </div>
    </Modal>
  );
}

function LeaveNotifyModal({ year, onClose }: { year: number; onClose: () => void }) {
  const [candidates, setCandidates] = useState<Array<{
    id: string; name: string; employeeNo: string | null; phone: string | null;
    hireDate: string | null; recommendDays: number; reason: string; remaining: number;
  }> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(
    `[CleanERP] ${year}년 연차 부여를 확인해주세요. 잔여가 부족하거나 미부여 상태입니다. 관리자에게 문의 바랍니다.`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    fetch(`/api/users/leave-notify?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setCandidates(d.candidates ?? []);
        setSelectedIds(new Set((d.candidates ?? []).filter((c: { phone: string | null }) => c.phone).map((c: { id: string }) => c.id)));
      })
      .catch(() => setCandidates([]));
  }, [year]);

  async function send(dryRun: boolean) {
    setSending(true);
    const res = await fetch('/api/users/leave-notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year, workerIds: Array.from(selectedIds), message, dryRun }),
    });
    const data = await res.json();
    setSending(false);
    setResult(data);
  }

  return (
    <Modal title={`잔여 0 알림 (${year}년)`} onClose={onClose}>
      {candidates === null && <div className="text-center text-slate-500 py-6 text-sm">대상 조회 중…</div>}
      {candidates && candidates.length === 0 && (
        <div className="text-center text-emerald-600 py-6 text-sm font-bold">대상 워커가 없습니다 (모두 잔여 보유).</div>
      )}
      {candidates && candidates.length > 0 && (
        <>
          <div className="text-xs font-bold text-ink-muted mb-2">
            대상 {candidates.length}명 · 발송 가능(전화번호 등록) {candidates.filter((c) => c.phone).length}명
          </div>
          <div className="border border-line rounded max-h-[260px] overflow-auto mb-3">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-slate-100 text-[0.625rem] font-mono font-extrabold text-slate-600">
                <tr>
                  <th className="px-2 py-1.5 text-center w-8"><input type="checkbox"
                    checked={selectedIds.size === candidates.filter((c) => c.phone).length}
                    onChange={(e) => setSelectedIds(e.target.checked
                      ? new Set(candidates.filter((c) => c.phone).map((c) => c.id))
                      : new Set())} /></th>
                  <th className="px-2 py-1.5 text-left">이름</th>
                  <th className="px-2 py-1.5 text-left">사번</th>
                  <th className="px-2 py-1.5 text-left">전화</th>
                  <th className="px-2 py-1.5 text-left">사유</th>
                  <th className="px-2 py-1.5 text-right">잔여</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.map((c) => (
                  <tr key={c.id} className={!c.phone ? 'bg-red-50 text-slate-600' : ''}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" disabled={!c.phone}
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(c.id); else next.delete(c.id);
                          setSelectedIds(next);
                        }} />
                    </td>
                    <td className="px-2 py-1.5 font-bold">{c.name}</td>
                    <td className="px-2 py-1.5 font-mono">{c.employeeNo ?? '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{c.phone ? formatPhone(c.phone) : <span className="text-red-500">미등록</span>}</td>
                    <td className="px-2 py-1.5 text-[0.625rem] font-bold">
                      {c.reason === 'NO_BALANCE' ? '미부여' : '소진'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold">{c.remaining.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Field label="알림 메시지">
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm" />
          </Field>

          {result != null && (
            <div className="mt-3 px-3 py-2 rounded bg-slate-100 text-[0.6875rem] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-1.5 rounded text-sm font-bold bg-white border border-line">닫기</button>
            <button disabled={sending || selectedIds.size === 0} onClick={() => send(true)}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-slate-200 text-ink hover:bg-slate-300 disabled:opacity-40">
              미리보기 (Dry-run)
            </button>
            <button disabled={sending || selectedIds.size === 0} onClick={() => send(false)}
              className="px-5 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
              {sending ? '발송 중…' : `${selectedIds.size}명 발송`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ────────────────────────  공용 컴포넌트  ──────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[680px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line flex items-center">
          <h3 className="font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-ink text-xl">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children, colSpan }: { title: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <div className={`col-span-${colSpan ?? 1}`}>
      <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 uppercase tracking-widest mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children, colSpan }: { label?: string; children: React.ReactNode; colSpan?: number }) {
  /* 사용자 요청 2026-04-29: 필드명 폰트 1단계 업 (text-[0.625rem] → text-xs 12px).
     canvas/file input은 <label> 내부에서 click forwarding 깨짐 → <div> 유지. */
  return (
    <div className={`block ${colSpan === 2 ? 'col-span-2' : ''}`}>
      {label && <div className="text-xs font-mono font-extrabold text-slate-600 mb-1">{label}</div>}
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder, disabled }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  /* type=tel — 한국 전화번호 자동 하이픈 + 숫자 키패드 + 13자리 cap */
  const isTel = type === 'tel';
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={isTel ? 'numeric' : undefined}
      maxLength={isTel ? 13 : undefined}
      onChange={(e) => onChange(isTel ? formatKoreanPhone(e.target.value) : e.target.value)}
      className="w-full px-3 py-1.5 rounded border border-line bg-white text-sm disabled:bg-slate-50 disabled:text-slate-600"
    />
  );
}

function SummaryCard({ title, value, unit, tone = 'default' }: { title: string; value: string; unit: string; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  /* 사용자 요청 2026-04-29: 텍스트 인식률 향상 (휴가 보고서 카드).
     - 카드 배경/테두리: 그라데이션 (attendance/vehicles 패턴 일치)
     - 제목: 10px uppercase tracking-widest(좌우 자간 늘림) → 14px font-extrabold text-ink-mid (AAA 15:1)
     - 값: 24px → 30px (text-3xl) font-black 으로 시인성 강화
     - 한글에 uppercase + tracking-widest 는 가독성 저해 → 제거 */
  const colors: Record<string, { card: string; value: string }> = {
    default: { card: 'bg-gradient-to-br from-slate-100 to-white border-slate-300', value: 'text-ink' },
    accent:  { card: 'bg-gradient-to-br from-cyan-50 to-white border-cyan-300',    value: 'text-cyan-900' },
    success: { card: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300', value: 'text-emerald-900' },
    warning: { card: 'bg-gradient-to-br from-amber-50 to-white border-amber-300',  value: 'text-amber-900' },
  };
  const c = colors[tone];
  return (
    <div className={`${c.card} border rounded-lg px-4 py-3 shadow-card`}>
      <div className="text-sm font-extrabold text-ink-mid">{title}</div>
      <div className="font-black mt-1.5">
        <span className={`text-3xl ${c.value}`}>{value}</span>
        <span className="text-sm font-bold text-ink-muted ml-1">{unit}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  /* 사용자 요청 2026-04-29: 라벨(부여/사용/잔여) 글자 진하게 — font-extrabold + text-ink-mid 추가. */
  const colors: Record<string, string> = {
    default: 'text-slate-600',
    accent: 'text-accent',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  };
  return (
    <div className="text-center">
      <div className="text-[0.625rem] font-mono font-extrabold text-ink-mid">{label}</div>
      <div className={`font-extrabold ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className="rounded-full object-cover border-2 border-line" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full bg-accent text-white font-extrabold flex items-center justify-center border-2 border-line"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {name.charAt(0)}
    </div>
  );
}

function PositionBadge({ p }: { p: { code: string; label: string; category: string } }) {
  return (
    <span className={`text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border ${POSITION_CATEGORY_COLOR[p.category] ?? POSITION_CATEGORY_COLOR.OTHER}`}>
      {p.label}
    </span>
  );
}

function PositionOptGroup({ positions, category }: { positions: PositionRow[]; category: string }) {
  const items = positions.filter((p) => p.category === category);
  if (items.length === 0) return null;
  return (
    <optgroup label={POSITION_CATEGORY_LABEL[category] ?? category}>
      {items.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
    </optgroup>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-300',
    MUNI_ADMIN: 'bg-blue-100 text-blue-700 border-blue-300',
    CONTRACTOR_ADMIN: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    INTERNAL_ADMIN: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    WORKER: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return <span className={`text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border ${colors[role] ?? colors.WORKER}`}>{ROLE_LABEL[role] ?? role}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    INACTIVE: 'bg-slate-200 text-slate-600 border-slate-400',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-300',
  };
  return <span className={`text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border ${colors[status] ?? colors.PENDING}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function LeaveStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-slate-200 text-slate-800 border-slate-400',
    IN_REVIEW: 'bg-amber-200 text-amber-900 border-amber-500',
    APPROVED: 'bg-emerald-200 text-emerald-900 border-emerald-600',
    REJECTED: 'bg-red-200 text-red-900 border-red-500',
  };
  return <span className={`text-[0.6875rem] font-extrabold px-2 py-0.5 rounded border-2 ${colors[status] ?? colors.PENDING}`}>{LEAVE_STATUS_LABEL[status] ?? status}</span>;
}

function formatPhone(p: string | null): string {
  if (!p) return '—';
  const digits = p.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return p;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
