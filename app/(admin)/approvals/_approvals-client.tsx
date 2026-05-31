'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'pending' | 'approved' | 'rejected' | 'history';

type ApprovalItem = {
  kind: 'leave' | 'attendance' | 'vehicleLog' | 'safety';
  id: string;
  personName: string;
  departmentName: string | null;
  summary: string;
  detail: string | null;
  routeDetail?: string | null;
  startMileage?: number | null;
  endMileage?: number | null;
  fuelUsed?: number | null;
  tripCount?: number | null;
  // safety-specific
  checklistItems?: Array<{ key: string; label: string; ok: boolean }> | null;
  allChecked?: boolean;
  severity?: string;
  locationAddress?: string | null;
  reportType?: string;
  status: string;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  leave: '휴가',
  attendance: '근태',
  vehicleLog: '운행일지',
  safety: '안전보고서',
};

const KIND_COLOR: Record<string, string> = {
  leave:      'bg-amber-100 text-amber-800 border-amber-300',
  attendance: 'bg-blue-100 text-blue-800 border-blue-300',
  vehicleLog: 'bg-teal-100 text-teal-800 border-teal-300',
  safety:     'bg-red-100 text-red-800 border-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:    '신청',
  IN_REVIEW:  '결재 중',
  APPROVED:   '승인',
  REJECTED:   '반려',
  SUBMITTED:  '제출',
  REVIEWED:   '검토 완료',
  DISMISSED:  '기각',
  DRAFT:      '임시저장',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border-amber-300',
  IN_REVIEW: 'bg-blue-50 text-blue-700 border-blue-300',
  APPROVED:  'bg-green-50 text-green-700 border-green-300',
  REJECTED:  'bg-red-50 text-red-700 border-red-300',
  SUBMITTED: 'bg-cyan-50 text-cyan-700 border-cyan-300',
  REVIEWED:  'bg-green-50 text-green-700 border-green-300',
  DISMISSED: 'bg-slate-100 text-slate-600 border-slate-300',
};

/* 개인별 결재 모달에서 어떤 action을 할 수 있는지 */
function getActions(item: ApprovalItem): { approve: boolean; reject: boolean; unapprove: boolean } {
  if (item.kind === 'leave' && (item.status === 'PENDING' || item.status === 'IN_REVIEW'))
    return { approve: true, reject: true, unapprove: false };
  if (item.kind === 'attendance' && item.status === 'PENDING')
    return { approve: true, reject: true, unapprove: false };
  if (item.kind === 'vehicleLog' && item.status === 'SUBMITTED')
    return { approve: true, reject: true, unapprove: false };
  if (item.kind === 'vehicleLog' && item.status === 'APPROVED')
    return { approve: false, reject: false, unapprove: true };
  if (item.kind === 'safety' && item.status === 'SUBMITTED')
    return { approve: true, reject: false, unapprove: false };
  return { approve: false, reject: false, unapprove: false };
}

export default function ApprovalsClient({ role }: { role: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState('');

  const load = useCallback(async (t: Tab, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: t });
      if (s) params.set('search', s);
      const res = await fetch(`/api/approvals/list?${params}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { items: ApprovalItem[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCheckedIds(new Set());
    setBulkError(null);
    const t = setTimeout(() => load(tab, search), 250);
    return () => clearTimeout(t);
  }, [tab, search, load]);

  const approvableItems = items.filter((item) => {
    const a = getActions(item);
    return a.approve;
  });
  const allApprovableChecked = approvableItems.length > 0 &&
    approvableItems.every((i) => checkedIds.has(`${i.kind}-${i.id}`));

  function toggleCheck(item: ApprovalItem) {
    const key = `${item.kind}-${item.id}`;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allApprovableChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(approvableItems.map((i) => `${i.kind}-${i.id}`)));
    }
  }

  async function bulkApprove() {
    const hasSafety = items.some(
      (i) => checkedIds.has(`${i.kind}-${i.id}`) && i.kind === 'safety'
    );
    if (hasSafety && bulkNote.trim().length < 2) {
      setBulkError('안전보고서 포함 시 검토 의견(2자 이상)을 입력하세요.');
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    try {
      const payload = items
        .filter((i) => checkedIds.has(`${i.kind}-${i.id}`))
        .map((i) => ({ kind: i.kind, id: i.id }));
      const res = await fetch('/api/approvals/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload, reviewNote: bulkNote.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBulkError(d.error ?? '일괄 승인 실패');
        return;
      }
      if (d.failCount > 0) {
        setBulkError(`${d.okCount}건 승인 완료, ${d.failCount}건 실패`);
      } else {
        setBulkError(null);
      }
      setCheckedIds(new Set());
      setBulkNote('');
      load(tab, search);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pending',  label: '결재 대기' },
    { key: 'approved', label: '승인' },
    { key: 'rejected', label: '반려' },
    { key: 'history',  label: '전체 이력' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-ink">결재 관리</h2>
        <p className="text-xs font-bold text-ink-muted mt-1">휴가 신청 · 근태 조정 · 운행일지 · 안전보고서 결재 통합 관리</p>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface-soft overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-extrabold transition-colors ${
                tab === t.key
                  ? 'bg-accent text-white'
                  : 'text-ink-muted hover:bg-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름으로 검색…"
          className="flex-1 min-w-[140px] max-w-[240px] px-3 py-2 rounded-lg border border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent"
        />
        <span className="text-xs font-mono text-ink-muted ml-auto">{items.length}건</span>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="py-12 text-center text-sm font-bold text-ink-muted">불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-12 text-center text-sm font-bold text-ink-muted">
          {tab === 'pending' ? '결재 대기 중인 문서가 없습니다.' : '해당 항목이 없습니다.'}
        </div>
      ) : (
        <>
          {/* 일괄승인 바 — 결재대기 탭 + 승인 가능 항목 있을 때 */}
          {tab === 'pending' && approvableItems.length > 0 && (
            <div className="bg-accent/5 border border-accent/30 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-extrabold text-accent">
                일괄승인 {checkedIds.size > 0 ? `${checkedIds.size}건 선택` : `(${approvableItems.length}건 가능)`}
              </span>
              {items.some((i) => checkedIds.has(`${i.kind}-${i.id}`) && i.kind === 'safety') && (
                <input
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  placeholder="안전보고서 검토 의견 (2자 이상 필수)"
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded border border-line text-xs font-bold focus:outline-none focus:border-accent"
                />
              )}
              {bulkError && <span className="text-xs font-bold text-danger">{bulkError}</span>}
              <button
                onClick={bulkApprove}
                disabled={bulkBusy || checkedIds.size === 0}
                className="ml-auto px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-extrabold hover:bg-cyan-800 disabled:opacity-50"
              >
                {bulkBusy ? '처리 중…' : `선택 ${checkedIds.size}건 일괄승인`}
              </button>
            </div>
          )}

          <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-surface-soft text-[0.6875rem] font-mono font-extrabold text-ink uppercase tracking-wider">
                <tr>
                  {tab === 'pending' && (
                    <th className="px-3 py-2.5 text-center w-8">
                      <input
                        type="checkbox"
                        checked={allApprovableChecked}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 accent-accent cursor-pointer"
                        title="승인 가능한 항목 전체 선택"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-left">종류</th>
                  <th className="px-4 py-2.5 text-left">신청인</th>
                  <th className="px-4 py-2.5 text-left">내용</th>
                  <th className="px-4 py-2.5 text-left">상태</th>
                  <th className="px-4 py-2.5 text-left">일시</th>
                  <th className="px-4 py-2.5 text-left">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => {
                  const actions = getActions(item);
                  const key = `${item.kind}-${item.id}`;
                  const isChecked = checkedIds.has(key);
                  const canCheck = tab === 'pending' && actions.approve;
                  return (
                    <tr key={key} className={`hover:bg-surface-soft/40 ${isChecked ? 'bg-accent/5' : ''}`}>
                      {tab === 'pending' && (
                        <td className="px-3 py-2.5 text-center">
                          {canCheck && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheck(item)}
                              className="w-3.5 h-3.5 accent-accent cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold border ${KIND_COLOR[item.kind]}`}>
                          {KIND_LABEL[item.kind]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-extrabold text-ink">{item.personName}</div>
                        {item.departmentName && (
                          <div className="text-[0.6875rem] text-ink-muted font-bold">{item.departmentName}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-ink">{item.summary}</div>
                        {item.detail && <div className="text-[0.6875rem] text-ink-muted font-bold mt-0.5 truncate max-w-[280px]">{item.detail}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[0.625rem] font-extrabold border ${STATUS_COLOR[item.status] ?? 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-muted font-bold whitespace-nowrap">
                        {fmtKst(item.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setSelected(item)}
                          className="px-2.5 py-1 rounded text-xs font-extrabold border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
                        >
                          {actions.approve || actions.reject ? '결재' : '상세'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <ApprovalDetailModal
          item={selected}
          role={role}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(tab, search); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ── 결재 상세 모달 ── */
function ApprovalDetailModal({
  item,
  role,
  onClose,
  onDone,
}: {
  item: ApprovalItem;
  role: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const actions = getActions(item);
  const isSafety = item.kind === 'safety';

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (item.kind === 'leave') {
        res = await fetch(`/api/leave-requests/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'APPROVE' }),
        });
      } else if (item.kind === 'attendance') {
        res = await fetch(`/api/attendance/${item.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      } else if (item.kind === 'vehicleLog') {
        res = await fetch(`/api/vehicle-logs/${item.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      } else if (item.kind === 'safety') {
        if (reviewNote.trim().length < 2) { setError('검토 의견을 2자 이상 입력하세요.'); setBusy(false); return; }
        res = await fetch(`/api/safety/reports/${item.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toStatus: 'REVIEWED', reviewNote: reviewNote.trim() }),
        });
      } else {
        setError('지원하지 않는 결재 유형입니다.');
        return;
      }
      if (res.ok) { onDone(); return; }
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? d?.error ?? '승인 처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectNote.trim()) { setError('반려 사유를 입력하세요.'); return; }
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (item.kind === 'leave') {
        res = await fetch(`/api/leave-requests/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REJECT', note: rejectNote.trim() }),
        });
      } else if (item.kind === 'attendance') {
        res = await fetch(`/api/attendance/${item.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectNote.trim() }),
        });
      } else if (item.kind === 'vehicleLog') {
        res = await fetch(`/api/vehicle-logs/${item.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectNote.trim() }),
        });
      } else {
        setError('지원하지 않는 결재 유형입니다.');
        return;
      }
      if (res.ok) { onDone(); return; }
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? d?.error ?? '반려 처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function unapprove() {
    if (!confirm('승인을 취소하고 제출 상태로 되돌립니다.\n주행거리 누적분도 역산됩니다. 계속하시겠습니까?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicle-logs/${item.id}/unapprove`, { method: 'POST' });
      if (res.ok) { onDone(); return; }
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? d?.error ?? '승인 취소에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold border ${KIND_COLOR[item.kind]}`}>
            {KIND_LABEL[item.kind]}
          </span>
          <h3 className="text-base font-extrabold text-ink flex-1">결재 상세</h3>
          <button onClick={onClose} className="text-2xl font-bold text-ink-muted">&times;</button>
        </header>
        <div className="p-5 space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <DetailRow label="신청인" value={item.personName} />
            {item.departmentName && <DetailRow label="부서" value={item.departmentName} />}
            <div className="col-span-2">
              <DetailRow label="내용" value={item.summary} />
            </div>
            {item.detail && item.kind !== 'safety' && (
              <div className="col-span-2">
                <DetailRow label="상세" value={item.detail} />
              </div>
            )}
            <DetailRow label="상태" value={STATUS_LABEL[item.status] ?? item.status} />
          </dl>

          {item.kind === 'vehicleLog' && (
            <div className="space-y-2">
              {/* 주행/연료 요약 */}
              {(item.startMileage != null || item.fuelUsed != null || item.tripCount != null) && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {item.startMileage != null && item.endMileage != null && (
                    <div className="bg-slate-50 border border-line rounded px-2 py-1.5">
                      <div className="text-[0.625rem] font-bold text-ink-muted">주행거리</div>
                      <div className="font-extrabold">{(item.endMileage - item.startMileage).toLocaleString()} km</div>
                      <div className="text-[0.625rem] text-ink-muted">{item.startMileage.toLocaleString()} → {item.endMileage.toLocaleString()}</div>
                    </div>
                  )}
                  {item.fuelUsed != null && (
                    <div className="bg-slate-50 border border-line rounded px-2 py-1.5">
                      <div className="text-[0.625rem] font-bold text-ink-muted">주유량</div>
                      <div className="font-extrabold">{item.fuelUsed.toFixed(1)} L</div>
                    </div>
                  )}
                  {item.tripCount != null && (
                    <div className="bg-slate-50 border border-line rounded px-2 py-1.5">
                      <div className="text-[0.625rem] font-bold text-ink-muted">운행횟수</div>
                      <div className="font-extrabold">{item.tripCount} 회</div>
                    </div>
                  )}
                </div>
              )}
              {/* 운행 상세 (routeDetail JSON) */}
              {item.routeDetail && <VehicleLogRouteDetail raw={item.routeDetail} />}
            </div>
          )}

          {item.kind === 'safety' && <SafetyReportDetail item={item} />}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <DetailRow label="제출일시" value={fmtKst(item.createdAt)} />
          </dl>

          {isSafety && actions.approve && (
            <div>
              <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">검토 의견 * (2자 이상)</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="검토 의견을 입력하세요… (예: 이상 없음 확인)"
                rows={2}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus:border-accent resize-none"
              />
            </div>
          )}

          {showRejectInput && (
            <div>
              <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">반려 사유 *</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="반려 사유를 입력하세요…"
                rows={3}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus:border-danger resize-none"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-800">{error}</div>
          )}
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
          {actions.reject && !showRejectInput && (
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-danger text-danger text-sm font-bold hover:bg-red-50 disabled:opacity-50"
            >
              반려
            </button>
          )}
          {actions.reject && showRejectInput && (
            <>
              <button
                onClick={() => { setShowRejectInput(false); setRejectNote(''); setError(null); }}
                disabled={busy}
                className="px-4 py-2 rounded-md border border-line text-sm font-bold"
              >
                취소
              </button>
              <button
                onClick={reject}
                disabled={busy || !rejectNote.trim()}
                className="px-4 py-2 rounded-md bg-danger text-white text-sm font-extrabold hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? '처리 중…' : '반려 확인'}
              </button>
            </>
          )}
          {actions.approve && !showRejectInput && (
            <button
              onClick={approve}
              disabled={busy || (isSafety && reviewNote.trim().length < 2)}
              className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50"
            >
              {busy ? '처리 중…' : isSafety ? '검토 완료' : '승인'}
            </button>
          )}
          {actions.unapprove && (
            <button
              onClick={unapprove}
              disabled={busy}
              className="px-4 py-2 rounded-md border-2 border-warn text-warn text-sm font-extrabold hover:bg-amber-50 disabled:opacity-50"
            >
              {busy ? '처리 중…' : '승인 취소'}
            </button>
          )}
          {!actions.approve && !actions.reject && !actions.unapprove && (
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm font-bold">닫기</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-extrabold text-ink-muted mb-0.5">{label}</dt>
      <dd className="font-bold text-ink text-sm">{value}</dd>
    </div>
  );
}

function fmtKst(iso: string): string {
  const d = new Date(iso);
  const k = new Date(d.getTime() + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

const SAFETY_TYPE_LABEL: Record<string, string> = {
  DAILY_CHECKLIST: '일일 안전점검',
  NEAR_MISS: '아차사고',
  INCIDENT: '재해 발생',
  TBM_SIGNATURE: 'TBM 서명',
};

const SEVERITY_LABEL: Record<string, string> = {
  NONE: '일반', MINOR: '경미', INJURY: '부상', SEVERE: '중상', FATAL: '사망',
};

function SafetyReportDetail({ item }: { item: ApprovalItem }) {
  const { checklistItems, allChecked, severity, locationAddress, reportType, detail } = item;
  const showSeverity = severity && severity !== 'NONE';

  return (
    <div className="space-y-3 text-xs">
      {/* 유형 / 심각도 / 위치 / 설명 */}
      <div className="bg-red-50 rounded-lg px-3 py-2.5 border border-red-200 space-y-1.5">
        <div className="font-extrabold text-red-900 mb-1">안전보고서 상세</div>
        {reportType && (
          <div className="font-mono">
            <span className="text-ink-muted">유형: </span>
            {SAFETY_TYPE_LABEL[reportType] ?? reportType}
          </div>
        )}
        {showSeverity && (
          <div className="font-mono font-bold text-danger">
            <span className="text-ink-muted font-normal">심각도: </span>
            {SEVERITY_LABEL[severity!] ?? severity}
          </div>
        )}
        {locationAddress && (
          <div className="font-mono">
            <span className="text-ink-muted">위치: </span>
            {locationAddress}
          </div>
        )}
        {detail && (
          <div className="font-mono whitespace-pre-wrap leading-relaxed">
            <span className="text-ink-muted">설명: </span>
            {detail}
          </div>
        )}
        {!detail && !checklistItems?.length && (
          <div className="text-ink-muted">작성된 상세내용이 없습니다.</div>
        )}
      </div>

      {/* 일일 체크리스트 */}
      {checklistItems && checklistItems.length > 0 && (
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-line">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-extrabold text-ink">일일 점검 체크리스트</span>
            <span className={`text-[0.625rem] px-1.5 py-0.5 rounded font-extrabold border ${
              allChecked
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
              {allChecked ? '전체 이상없음' : '미완료 항목 있음'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {checklistItems.map((ci) => (
              <div key={ci.key} className="flex items-center gap-2 font-mono">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[0.625rem] font-extrabold flex-shrink-0 ${
                  ci.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {ci.ok ? '✓' : '✕'}
                </span>
                <span className={ci.ok ? 'text-ink' : 'text-danger font-bold'}>{ci.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const INSPECTION_KEY_LABEL: Record<string, string> = {
  safetyBar: '안전멈춤Bar', handSwitch: '양손조작안전스위치', dashcam: '블랙박스',
  turnSignal: '방향지시등', engineOil: '엔진오일', lubricant: '윤활제',
  brake: '브레이크', tire: '타이어', headlight: '전조등', carWash: '세차여부',
};
const BAG_MACHINE_LABEL: Record<string, string> = {
  food_1L: '음식물 1L', food_2L: '음식물 2L', food_3L: '음식물 3L', food_5L: '음식물 5L', food_10L: '음식물 10L',
  living_5L: '생활 5L', living_10L: '생활 10L', living_20L: '생활 20L', living_30L: '생활 30L', living_50L: '생활 50L', living_75L: '생활 75L',
  reuse_10L: '재사용 10L', reuse_20L: '재사용 20L',
  illegal_20: '무단투기(20기준)', special: '특수', deadAnimal: '동물사채(마대)',
};
const LARGE_WASTE_LABEL: Record<string, string> = {
  furniture: '가구류', chair: '의자류', sofa: '쇼파류', bed: '침대류',
  appliance: '가전제품', extinguisher: '소화기', household: '생활용품', other: '기타',
  illegalTotal: '무단투기 총합',
};

function VehicleLogRouteDetail({ raw }: { raw: string }) {
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }

  const passengers = typeof d.passengers === 'string' ? d.passengers : null;
  const fuelUsed = d.fuelUsed != null ? String(d.fuelUsed) : null;
  const note = typeof d.note === 'string' ? d.note : null;
  const hasReceipt = !!d.receiptPhoto;
  const bagWork = Array.isArray(d.bagWork) ? (d.bagWork as Record<string, string>[]) : null;
  const bagMachineWork = d.bagMachineWork && typeof d.bagMachineWork === 'object' ? (d.bagMachineWork as Record<string, string>) : null;
  const largeWasteWork = d.largeWasteWork && typeof d.largeWasteWork === 'object' ? (d.largeWasteWork as Record<string, string>) : null;
  const inspection = d.inspection && typeof d.inspection === 'object' ? (d.inspection as Record<string, string>) : null;

  return (
    <div className="space-y-3 text-xs">
      {(passengers || note || fuelUsed || hasReceipt) && (
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 space-y-1 border border-line">
          <div className="font-extrabold text-ink mb-1">운행 정보</div>
          {passengers && <div className="font-mono">동승자: {passengers}</div>}
          {fuelUsed && <div className="font-mono">주유량: {fuelUsed}L</div>}
          {hasReceipt && <div className="font-mono text-slate-500">영수증: 첨부됨</div>}
          {note && <div className="font-mono whitespace-pre-wrap">특이사항: {note}</div>}
        </div>
      )}

      {bagWork && bagWork.length > 0 && (
        <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-200">
          <div className="font-extrabold text-blue-900 mb-1.5">작업내역 A — 중량제봉투·음식물·재활 (kg)</div>
          <table className="w-full border-collapse">
            <thead><tr className="text-blue-700">
              <th className="text-left pr-2 pb-1 font-extrabold">회차</th>
              <th className="pr-2 pb-1 font-extrabold">일반</th>
              <th className="pr-2 pb-1 font-extrabold">음식물</th>
              <th className="pr-2 pb-1 font-extrabold">재활용</th>
              <th className="text-left pb-1 font-extrabold">반입장소</th>
              <th className="text-left pb-1 font-extrabold">비고</th>
            </tr></thead>
            <tbody>
              {bagWork.map((row, i) => (
                <tr key={i} className="font-mono">
                  <td className="pr-2 py-0.5 text-blue-700">{i + 1}회</td>
                  <td className="pr-2 py-0.5 text-center">{row.general || '—'}</td>
                  <td className="pr-2 py-0.5 text-center">{row.food || '—'}</td>
                  <td className="pr-2 py-0.5 text-center">{row.recycle || '—'}</td>
                  <td className="py-0.5 pr-2">{row.disposalSite || '—'}</td>
                  <td className="py-0.5">{row.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bagMachineWork && Object.values(bagMachineWork).some((v) => Number(v) > 0) && (
        <div className="bg-green-50 rounded-lg px-3 py-2.5 border border-green-200">
          <div className="font-extrabold text-green-900 mb-1.5">작업내역 B — 중량계·봉투 수거 (L)</div>
          <div className="font-mono grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(bagMachineWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{BAG_MACHINE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {largeWasteWork && Object.values(largeWasteWork).some((v) => Number(v) > 0) && (
        <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
          <div className="font-extrabold text-amber-900 mb-1.5">작업내역 C — 대형폐기물 (점)</div>
          <div className="font-mono grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(largeWasteWork).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <span key={k}>{LARGE_WASTE_LABEL[k] ?? k}: {v}</span>
            ))}
          </div>
        </div>
      )}

      {inspection && (
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-line">
          <div className="font-extrabold text-ink mb-1.5">차량 점검</div>
          <div className="font-mono grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(inspection).map(([k, v]) => (
              <span key={k} className={v === '이상' ? 'text-danger font-bold' : v === '수리점검' ? 'text-warn font-bold' : ''}>
                {INSPECTION_KEY_LABEL[k] ?? k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
