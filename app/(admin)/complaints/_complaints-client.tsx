'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import ProfilePhotoUploader from '@/components/ProfilePhotoUploader';
import MultiPhotoUploader from '@/components/MultiPhotoUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { FilterToggle } from '@/components/FilterToggle';
import { useToast } from '@/components/ui/Toast';
import { formatKoreanPhone } from '@/lib/phone';

/* leaflet은 SSR 불가 — 동적 import */
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] rounded-lg border-2 border-line bg-surface-soft flex items-center justify-center text-xs font-mono text-ink-muted">
      🗺️ 지도 로딩 중…
    </div>
  ),
});

export type Worker = { id: string; name: string };
export type WorkerRef = { id: string; name: string };
export type ContractorOpt = { id: string; name: string };

export type Row = {
  id: string;
  type: string;
  status: string;
  description: string | null;
  locationAddress: string | null;
  /* 좌표는 admin 화면에서 직접 노출하지 않지만, 향후 지도 표시·재배정 시 사용을 위해 보존 */
  locationLat: number | null;
  locationLng: number | null;
  reportedAt: string;
  dueDate: string | null;
  overdue: boolean;
  reporter: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  zoneName: string | null;
  resolveNote: string | null;
  resolvedAt: string | null;
  complainantPhone: string | null;
  requestImage: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비',
  BULKY_WASTE: '대형폐기물',
  ILLEGAL_DUMP: '불법투기',
  ODOR_NOISE: '악취/소음',
  OTHER: '기타',
};

type Tab = 'ALL' | 'PENDING' | 'OVERDUE' | 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export default function ComplaintsClient({
  role,
  userId,
  items,
  workers,
  contractorOpts,
}: {
  role: string;
  userId: string;
  items: Row[];
  workers: Worker[];
  contractorOpts: ContractorOpt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('ALL');
  const [busy, setBusy] = useState(false);
  const [openAssignId, setOpenAssignId] = useState<string | null>(null);
  const [openCompleteId, setOpenCompleteId] = useState<string | null>(null);
  const [openRejectId, setOpenRejectId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = role === 'SUPER_ADMIN' || role === 'CONTRACTOR_ADMIN' || role === 'INTERNAL_ADMIN';
  const isMuni = role === 'MUNI_ADMIN';
  const canCreate = isManager || isMuni;
  const needsContractorPicker = role === 'SUPER_ADMIN' || role === 'MUNI_ADMIN';

  const filtered = useMemo(() => {
    if (tab === 'ALL') return items;
    if (tab === 'PENDING') return items.filter((i) => ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status));
    if (tab === 'OVERDUE') return items.filter((i) => i.overdue);
    return items.filter((i) => i.status === tab);
  }, [items, tab]);

  const counts = useMemo(() => ({
    ALL: items.length,
    PENDING: items.filter((i) => ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status)).length,
    OVERDUE: items.filter((i) => i.overdue).length,
    RECEIVED: items.filter((i) => i.status === 'RECEIVED').length,
    IN_PROGRESS: items.filter((i) => i.status === 'IN_PROGRESS').length,
    COMPLETED: items.filter((i) => i.status === 'COMPLETED').length,
    REJECTED: items.filter((i) => i.status === 'REJECTED').length,
  }), [items]);

  async function call(path: string, body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '요청 실패');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('네트워크 오류');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ALL',        label: '전체' },
    { key: 'PENDING',    label: '미처리' },
    { key: 'OVERDUE',    label: '초과' },
    { key: 'RECEIVED',   label: '접수' },
    { key: 'IN_PROGRESS', label: '처리중' },
    { key: 'COMPLETED',  label: '완료' },
    { key: 'REJECTED',   label: '반려' },
  ];

  return (
    <div className="max-w-6xl space-y-5">
      {/* 페이지 헤더 */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">민원 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">
            Plan §3-3 — 업체담당자 / 관리자 / 지자체 공무원 / 근로자 모두 입력 가능
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMuni && (
            <span className="px-3 py-1 rounded-full text-[0.625rem] font-mono font-extrabold bg-amber-100 text-warn border border-amber-300">
              MUNI_ADMIN — 입력만 허용 (처리는 위탁업체)
            </span>
          )}
          {canCreate && (
            <button
              onClick={() => { setOpenCreate(true); setError(null); }}
              className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 shadow-card"
            >
              + 민원 등록
            </button>
          )}
        </div>
      </header>

      {/* 탭 — 모바일에서는 FilterToggle로 collapsible */}
      <FilterToggle
        label={`상태: ${tabs.find((t) => t.key === tab)?.label ?? '전체'}`}
        activeCount={tab === 'ALL' ? 0 : 1}
      >
        <nav className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition ${
                tab === t.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink hover:bg-surface-soft'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-[0.6875rem] font-mono ${tab === t.key ? 'text-cyan-100' : 'text-ink-muted'}`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </nav>
      </FilterToggle>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">
          오류: {error}
        </div>
      )}

      {openCreate && (
        <CreateComplaintModal
          contractorOpts={contractorOpts}
          needsContractorPicker={needsContractorPicker}
          onCancel={() => setOpenCreate(false)}
          onSubmit={async (body) => {
            setBusy(true); setError(null);
            try {
              const res = await fetch('/api/complaints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = data?.message ?? data?.error ?? '등록 실패';
                setError(msg);
                toast.error(`민원 등록 실패: ${msg}`);
                return false;
              }
              setOpenCreate(false);
              toast.success('민원이 등록되었습니다.');
              router.refresh();
              return true;
            } catch {
              setError('네트워크 오류');
              toast.error('네트워크 오류 — 등록을 다시 시도해 주세요.');
              return false;
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {/* 리스트 */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-surface border border-line rounded-xl py-16 text-center text-sm text-ink-muted font-bold">
            해당 조건에 맞는 민원이 없습니다.
          </div>
        )}
        {filtered.map((c) => (
          <article key={c.id} className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <ComplaintIcon type={c.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[0.9375rem] font-extrabold text-ink">{TYPE_LABEL[c.type] ?? c.type}</span>
                  <StatusChip status={c.status} overdue={c.overdue} />
                  <code className="text-[0.625rem] font-mono text-ink-faint">#{c.id}</code>
                </div>
                <div className="text-sm text-ink font-semibold">
                  {c.locationAddress ?? '주소 없음'}
                </div>
                {c.description && (
                  <div className="text-xs text-ink-muted font-semibold mt-1.5 line-clamp-2">
                    {c.description}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[0.6875rem] font-mono font-bold text-ink-faint">
                  <span>접수: {fmt(c.reportedAt)}</span>
                  <span>보고자: <span className="text-ink">{c.reporter.name}</span></span>
                  <span>담당: {c.assignee ? <span className="text-accent">{c.assignee.name}</span> : <span className="text-warn">미배정</span>}</span>
                  {c.dueDate && (
                    <span className={c.overdue ? 'text-danger' : ''}>
                      마감: {fmtDate(c.dueDate)}{c.overdue && ' ⚠'}
                    </span>
                  )}
                  {c.zoneName && <span>구역: {c.zoneName}</span>}
                </div>
                {c.complainantPhone && (
                  <div className="mt-1.5 text-[0.6875rem] font-mono font-bold text-ink-muted">
                    📞 {c.complainantPhone}
                  </div>
                )}
                {c.resolveNote && (
                  <div className="mt-2.5 px-3 py-2 bg-surface-alt rounded-md text-xs text-ink-muted font-semibold border-l-4 border-l-success">
                    <strong className="text-ink">처리 메모:</strong> {c.resolveNote}
                  </div>
                )}
                {c.requestImage && (() => {
                  let imgs: string[] = [];
                  try { imgs = JSON.parse(c.requestImage); if (!Array.isArray(imgs)) imgs = [c.requestImage]; }
                  catch { imgs = [c.requestImage]; }
                  return (
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {imgs.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                          <img src={src} alt={`현장사진 ${i + 1}`} className="w-16 h-16 object-cover rounded-md border border-line hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 액션 영역 */}
            {!isMuni && (
              <div className="px-5 py-3 bg-surface-soft border-t border-line flex flex-wrap gap-2">
                {isManager && (
                  <button
                    onClick={() => { setOpenAssignId(c.id); setOpenCompleteId(null); setOpenRejectId(null); }}
                    disabled={busy}
                    className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md border-2 border-accent text-accent text-sm sm:text-xs font-extrabold hover:bg-accent hover:text-white transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    {c.assignee ? '담당 변경' : '담당 배정'}
                  </button>
                )}
                {(c.status === 'RECEIVED' || c.status === 'ASSIGNED') &&
                  (c.assignee?.id === userId || isManager) && (
                    <button
                      onClick={() => call(`/api/complaints/${c.id}/start`)}
                      disabled={busy}
                      className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md border-2 border-info text-info text-sm sm:text-xs font-extrabold hover:bg-info hover:text-white transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                    >
                      처리 시작
                    </button>
                  )}
                {c.status !== 'COMPLETED' && c.status !== 'REJECTED' &&
                  (c.assignee?.id === userId || isManager) && (
                    <button
                      onClick={() => { setOpenCompleteId(c.id); setOpenAssignId(null); setOpenRejectId(null); }}
                      disabled={busy}
                      className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md bg-success text-white text-sm sm:text-xs font-extrabold hover:bg-green-700 transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                    >
                      처리 완료
                    </button>
                  )}
                {isManager && (
                  <button
                    onClick={() => setEditTarget(c)}
                    disabled={busy}
                    className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md border-2 border-warn text-warn text-sm sm:text-xs font-extrabold hover:bg-warn hover:text-white transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    수정
                  </button>
                )}
                {c.status !== 'COMPLETED' && c.status !== 'REJECTED' && isManager && (
                  <button
                    onClick={() => { setOpenRejectId(c.id); setOpenAssignId(null); setOpenCompleteId(null); }}
                    disabled={busy}
                    className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md border-2 border-danger text-danger text-sm sm:text-xs font-extrabold hover:bg-danger hover:text-white transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    반려
                  </button>
                )}
                {isManager && (
                  <button
                    onClick={() => setDeleteTarget(c.id)}
                    disabled={busy}
                    className="ml-auto px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-md border-2 border-slate-400 text-slate-500 text-sm sm:text-xs font-extrabold hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    삭제
                  </button>
                )}
              </div>
            )}

            {/* 인라인 폼 — Assign */}
            {openAssignId === c.id && (
              <AssignForm
                workers={workers}
                onCancel={() => setOpenAssignId(null)}
                onSubmit={async (assignedTo, dueDate) => {
                  const ok = await call(`/api/complaints/${c.id}/assign`, { assignedTo, dueDate });
                  if (ok) setOpenAssignId(null);
                }}
              />
            )}
            {openCompleteId === c.id && (
              <CompleteNoteForm
                workers={workers}
                onCancel={() => setOpenCompleteId(null)}
                onSubmit={async (note, taggedUserId) => {
                  const ok = await call(`/api/complaints/${c.id}/complete`, {
                    resolveNote: note,
                    taggedUserId: taggedUserId || undefined,
                  });
                  if (ok) setOpenCompleteId(null);
                }}
              />
            )}
            {openRejectId === c.id && (
              <NoteForm
                label="반려 사유"
                placeholder="반려 사유를 입력하세요 (최소 2자)"
                buttonLabel="반려 처리"
                buttonClass="bg-danger hover:bg-red-700"
                onCancel={() => setOpenRejectId(null)}
                onSubmit={async (reason) => {
                  const ok = await call(`/api/complaints/${c.id}/reject`, { reason });
                  if (ok) setOpenRejectId(null);
                }}
              />
            )}
          </article>
        ))}
      </div>

      {editTarget && (
        <EditComplaintModal
          row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); router.refresh(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="text-base font-extrabold text-ink">민원 삭제 확인</div>
            <div className="text-sm text-ink-muted">이 민원(#{deleteTarget})을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-md border border-line text-sm font-bold">취소</button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true); setError(null);
                  try {
                    const res = await fetch(`/api/complaints/${deleteTarget}`, { method: 'DELETE' });
                    if (res.ok) { setDeleteTarget(null); router.refresh(); }
                    else setError((await res.json().catch(() => ({}))).error ?? '삭제 실패');
                  } catch { setError('네트워크 오류'); }
                  finally { setBusy(false); }
                }}
                className="px-4 py-2 rounded-md bg-danger text-white text-sm font-extrabold disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditComplaintModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState(row.type);
  const [status, setStatus] = useState(row.status);
  const [description, setDescription] = useState(row.description ?? '');
  const [address, setAddress] = useState(row.locationAddress ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (type !== row.type) body.type = type;
    if (status !== row.status) body.status = status;
    if (description !== (row.description ?? '')) body.description = description || null;
    if (address !== (row.locationAddress ?? '')) body.locationAddress = address || null;
    if (photoChanged) body.requestImage = photo;
    if (Object.keys(body).length === 0) {
      setError('변경된 항목이 없습니다.');
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/complaints/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError((await res.json().catch(() => ({}))).error ?? '저장 실패');
  }

  return (
    <BottomSheet open={true} onClose={onClose} title={`민원 수정 #${row.id}`}>
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-extrabold text-ink mb-1">민원 유형</label>
          <select value={type} onChange={(e) => setType(e.target.value as Row['type'])}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface">
            <option value="PICKUP_MISS">수거 누락</option>
            <option value="BULKY_WASTE">대형폐기물</option>
            <option value="ILLEGAL_DUMP">무단 투기</option>
            <option value="ODOR_NOISE">악취·소음</option>
            <option value="OTHER">기타</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-ink mb-1">처리 상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface">
            <option value="RECEIVED">수거대기</option>
            <option value="ASSIGNED">보류</option>
            <option value="IN_PROGRESS">처리중</option>
            <option value="COMPLETED">수거완료</option>
            <option value="REJECTED">반려</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-ink mb-1">발생 위치 (GIS 자동)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="상세 주소" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold" />
        </div>
        <div>
          <label className="block text-xs font-extrabold text-ink mb-1">민원 내용</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold resize-none" />
        </div>
        <div>
          <label className="block text-xs font-extrabold text-ink mb-1">현장 사진 교체 (선택)</label>
          <ProfilePhotoUploader onChange={(d) => { setPhoto(d); setPhotoChanged(true); }} size={64} />
          {row.id && (
            <div className="text-[0.625rem] font-mono text-slate-600 mt-1">기존 사진은 변경 시에만 교체됩니다.</div>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
      </div>
      <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm font-bold min-h-[44px]">취소</button>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold disabled:opacity-50 min-h-[44px]">
          {saving ? '저장 중…' : '저장'}
        </button>
      </footer>
    </BottomSheet>
  );
}

/* ─────────────── 보조 컴포넌트 ─────────────── */

function ComplaintIcon({ type }: { type: string }) {
  const map: Record<string, { wrap: string; path: string }> = {
    PICKUP_MISS:  { wrap: 'bg-red-100 text-danger',    path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    ILLEGAL_DUMP: { wrap: 'bg-amber-100 text-warn',    path: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6' },
    ODOR_NOISE:   { wrap: 'bg-blue-100 text-info',     path: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    OTHER:        { wrap: 'bg-slate-100 text-ink-muted', path: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  };
  const m = map[type] ?? map.OTHER;
  return (
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${m.wrap}`}>
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={m.path} />
      </svg>
    </div>
  );
}

function StatusChip({ status, overdue }: { status: string; overdue: boolean }) {
  if (overdue && status !== 'COMPLETED' && status !== 'REJECTED') {
    return <Chip className="bg-red-100 text-danger border-red-200">초과</Chip>;
  }
  switch (status) {
    case 'RECEIVED':    return <Chip className="bg-amber-100 text-warn border-amber-200">접수</Chip>;
    case 'ASSIGNED':    return <Chip className="bg-blue-100 text-info border-blue-200">배정</Chip>;
    case 'IN_PROGRESS': return <Chip className="bg-amber-100 text-warn border-amber-200">처리중</Chip>;
    case 'COMPLETED':   return <Chip className="bg-green-100 text-success border-green-200">완료</Chip>;
    case 'REJECTED':    return <Chip className="bg-slate-100 text-ink-muted border-slate-200">반려</Chip>;
  }
  return <Chip className="bg-slate-100 text-ink-muted border-slate-200">{status}</Chip>;
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function AssignForm({
  workers,
  onSubmit,
  onCancel,
}: {
  workers: Worker[];
  onSubmit: (assignedTo: string, dueDate?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [w, setW] = useState(workers[0]?.id ?? '');
  const [due, setDue] = useState('');
  return (
    <div className="px-5 py-4 bg-cyan-50 border-t border-accent space-y-3">
      <div className="text-xs font-extrabold text-ink mb-1">담당자 배정</div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[0.625rem] font-bold text-ink-muted mb-1">담당자</label>
          <select value={w} onChange={(e) => setW(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
            {workers.length === 0 && <option value="">근로자 없음</option>}
            {workers.map((wk) => (
              <option key={wk.id} value={wk.id}>{wk.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[0.625rem] font-bold text-ink-muted mb-1">처리 기한 (선택)</label>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold bg-surface focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => onSubmit(w, due ? new Date(due).toISOString() : undefined)}
          disabled={!w || workers.length === 0}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 disabled:opacity-50"
        >
          저장
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-ink text-sm font-bold hover:bg-surface-soft active:scale-95">
          취소
        </button>
      </div>
    </div>
  );
}

function NoteForm({
  label,
  placeholder,
  buttonLabel,
  buttonClass,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  buttonLabel: string;
  buttonClass: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="px-5 py-4 bg-surface-soft border-t border-line space-y-3">
      <div className="text-xs font-extrabold text-ink">{label}</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold bg-surface focus:outline-none focus:border-accent resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(note.trim())}
          disabled={note.trim().length < 2}
          className={`px-4 py-2 rounded-md text-white text-sm font-extrabold transition active:scale-95 disabled:opacity-50 ${buttonClass}`}
        >
          {buttonLabel}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-ink text-sm font-bold hover:bg-surface active:scale-95">
          취소
        </button>
      </div>
    </div>
  );
}

function CompleteNoteForm({
  workers,
  onSubmit,
  onCancel,
}: {
  workers: Worker[];
  onSubmit: (note: string, taggedUserId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [taggedWorker, setTaggedWorker] = useState('');
  const taggedName = workers.find((w) => w.id === taggedWorker)?.name ?? '';
  const displayNote = taggedName ? `${note.trim()} → @${taggedName} 알림` : note.trim();

  return (
    <div className="px-5 py-4 bg-surface-soft border-t border-line space-y-3">
      <div className="text-xs font-extrabold text-ink">처리 완료 메모</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="처리 내용을 기록해 주세요 (최소 2자)"
        rows={2}
        className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold bg-surface focus:outline-none focus:border-accent resize-none"
      />
      {workers.length > 0 && (
        <div>
          <label className="block text-[0.625rem] font-bold text-ink-muted mb-1">
            담당자 태그 (선택 — 태그 시 해당 워커에게 개인 알림 발송)
          </label>
          <select
            value={taggedWorker}
            onChange={(e) => setTaggedWorker(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent"
          >
            <option value="">— 태그 없음 —</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {taggedWorker && (
            <p className="text-[0.6875rem] text-accent mt-1">
              ✓ {taggedName}님의 공지사항에 알림이 전송됩니다.
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(displayNote, taggedWorker)}
          disabled={note.trim().length < 2}
          className="px-4 py-2 rounded-md text-white text-sm font-extrabold transition active:scale-95 disabled:opacity-50 bg-success hover:bg-green-700"
        >
          완료 처리
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-ink text-sm font-bold hover:bg-surface active:scale-95">
          취소
        </button>
      </div>
    </div>
  );
}

function fmt(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

/* ─────────────── 민원 등록 모달 ─────────────── */

const COMPLAINT_TYPES = [
  { id: 'PICKUP_MISS',  label: '수거 미비',   color: 'border-red-400 bg-red-50 text-red-700' },
  { id: 'ILLEGAL_DUMP', label: '불법투기',   color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'ODOR_NOISE',   label: '악취/소음',   color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'BULKY_WASTE',  label: '대형폐기물', color: 'border-purple-400 bg-purple-50 text-purple-700' },
  { id: 'OTHER',        label: '기타',        color: 'border-slate-400 bg-slate-50 text-slate-700' },
] as const;

type CType = typeof COMPLAINT_TYPES[number]['id'];

function CreateComplaintModal({
  contractorOpts,
  needsContractorPicker,
  onCancel,
  onSubmit,
  busy,
}: {
  contractorOpts: ContractorOpt[];
  needsContractorPicker: boolean;
  onCancel: () => void;
  onSubmit: (body: object) => Promise<boolean>;
  busy: boolean;
}) {
  const [type, setType] = useState<CType | null>(null);
  const [contractorId, setContractorId] = useState<string>(contractorOpts[0]?.id ?? '');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [addressOnly, setAddressOnly] = useState(false);

  function pickGps() {
    if (!('geolocation' in navigator)) {
      /* GIS 서버 fallback — 회사 기본 좌표 (강남구 중심) */
      setGps({ lat: 37.4979, lng: 127.0473 });
      setGpsErr('브라우저 GPS 미지원 → 지도에서 직접 위치 지정');
      return;
    }
    setAcquiring(true);
    setGpsErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGps(next);
        setAcquiring(false);
        reverseGeocode(next.lat, next.lng);
      },
      () => {
        /* GIS 서버 fallback — 권한 거부 시 회사 기본 좌표 */
        setGps({ lat: 37.4979, lng: 127.0473 });
        setGpsErr('GPS 권한 거부 → 지도에서 핀을 끌어 위치를 지정하세요');
        setAcquiring(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /* OSM Nominatim 역지오코딩 — 좌표 → 한글 주소 */
  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko&zoom=18`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (r.ok) {
        const j = (await r.json()) as { display_name?: string };
        if (j.display_name && !address.trim()) {
          setAddress(j.display_name);
        }
      }
    } catch {
      /* 무시 — 사용자가 직접 입력 가능 */
    } finally {
      setGeocoding(false);
    }
  }

  function onMapPinChange(lat: number, lng: number) {
    setGps({ lat, lng });
    setGpsErr(null);
    reverseGeocode(lat, lng);
  }

  /* 모달 오픈 시 자동 GPS/GIS 트리거 — 지도 모드에서만 */
  useEffect(() => {
    if (!addressOnly) pickGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressOnly]);

  async function save() {
    if (!type) { setError('민원 유형을 선택해 주세요.'); return; }
    if (needsContractorPicker && !contractorId) { setError('위탁업체를 선택해 주세요.'); return; }
    setError(null);
    const body: Record<string, unknown> = { type };
    if (description.trim()) body.description = description.trim();
    if (address.trim()) body.locationAddress = address.trim();
    if (phone.trim()) body.complainantPhone = phone.trim();
    if (gps) { body.locationLat = gps.lat; body.locationLng = gps.lng; }
    if (photos.length > 0) body.requestImages = photos;
    if (needsContractorPicker) body.contractorId = contractorId;
    await onSubmit(body);
  }

  return (
    <BottomSheet open={true} onClose={onCancel} title="민원 신규 등록">
      <div className="p-5 space-y-4">
          {needsContractorPicker && (
            <div>
              <label className="block text-xs font-extrabold text-ink mb-2">위탁업체 선택 *</label>
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent"
              >
                <option value="">— 위탁업체 선택 —</option>
                {contractorOpts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-ink mb-2">민원 유형 *</label>
            <div className="grid grid-cols-2 gap-2">
              {COMPLAINT_TYPES.map((t) => (
                <label
                  key={t.id}
                  className={`px-3 py-3 rounded-lg border-2 ${t.color} text-center text-sm font-extrabold cursor-pointer active:scale-[0.98] transition ${type === t.id ? 'ring-2 ring-accent ring-offset-2' : ''}`}
                >
                  <input type="radio" name="ctype" checked={type === t.id} onChange={() => setType(t.id as CType)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-ink">
                발생 위치
                {!addressOnly && <span className="ml-1.5 text-[0.625rem] font-mono font-bold text-ink-muted">(지도에서 핀 클릭·드래그로 보정)</span>}
              </label>
              <button
                type="button"
                onClick={() => setAddressOnly((v) => !v)}
                className="text-[0.625rem] font-extrabold px-2.5 py-1 rounded-md border border-line hover:bg-surface-soft text-ink"
              >
                {addressOnly ? '🗺️ 지도 모드' : '⌨️ 주소만 입력'}
              </button>
            </div>

            {addressOnly ? (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="상세 주소를 직접 입력하세요 (전화·카톡 민원 등)"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
                autoFocus
              />
            ) : (
              <>
                {/* 지도 — 항상 표시 (GPS 미확인 시 기본 좌표) */}
                <div className="mb-2 relative">
                  <LocationPickerMap
                    lat={gps?.lat ?? 37.5665}
                    lng={gps?.lng ?? 126.9780}
                    onChange={onMapPinChange}
                    height={220}
                  />
                  {!gps && (
                    <div className="absolute top-2 left-2 right-2 px-3 py-1.5 rounded-md bg-amber-100/95 border border-amber-300 text-[0.6875rem] font-bold text-amber-900 backdrop-blur shadow-sm pointer-events-none">
                      📍 GPS 위치 확인 중… (핀을 드래그해도 됩니다)
                    </div>
                  )}
                </div>

                {/* GPS 상태 + 좌표 + 재확인 버튼 */}
                <div className="bg-surface-alt rounded-lg border border-line px-3 py-2 flex items-center gap-2 mb-2">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={gps ? 'text-success' : 'text-warn'}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex-1 text-[0.6875rem]">
                    {gps ? (
                      <span className="font-mono font-bold text-ink">
                        {gps.lat.toFixed(5)}°N, {gps.lng.toFixed(5)}°E
                        {geocoding && <span className="ml-2 text-accent animate-pulse">주소 조회 중…</span>}
                      </span>
                    ) : (
                      <span className="text-ink-muted">위치 자동 확인 중…</span>
                    )}
                    {gpsErr && <div className="text-[0.625rem] font-bold text-amber-700 mt-0.5">{gpsErr}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={pickGps}
                    disabled={acquiring}
                    className="text-[0.625rem] font-extrabold px-2.5 py-1 rounded-md border border-line hover:bg-surface text-ink"
                  >
                    {acquiring ? '확인 중…' : '🎯 내 위치'}
                  </button>
                </div>

                {/* 주소 (역지오코딩으로 자동 채워짐 / 수정 가능) */}
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="상세 주소 (지도 클릭 시 자동 입력 · 수정 가능)"
                  className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
                />
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold text-ink mb-2">민원 내용</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="민원 내용·현장 상황을 구체적으로 기록해 주세요"
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-ink mb-2">민원인 연락처 (선택)</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
              placeholder="010-0000-0000"
              maxLength={13}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-semibold focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-ink mb-2">
              현장 사진
              <span className="ml-1.5 text-[0.625rem] font-mono font-bold text-ink-muted">(최대 3장 · 카메라 직촬 가능)</span>
            </label>
            <MultiPhotoUploader onChange={setPhotos} max={3} />
          </div>
        </div>

      <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
        <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface min-h-[44px]">취소</button>
        <button onClick={save} disabled={busy || !type || (needsContractorPicker && !contractorId)} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50 min-h-[44px]">
          {busy ? '등록 중…' : '민원 등록'}
        </button>
      </footer>
    </BottomSheet>
  );
}
function fmtDate(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`;
}
