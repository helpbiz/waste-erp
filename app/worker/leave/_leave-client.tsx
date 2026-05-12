'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
const PRIMARY_TYPES = ['ANNUAL', 'ANNUAL_HALF', 'SPECIAL', 'MATERNITY', 'FAMILY_CARE', 'MENSTRUAL', 'OFFICIAL', 'SICK', 'OTHER'];

type LeaveRequest = {
  id: string;
  requestType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
};

type Balance = {
  granted: number;
  used: number;
  carriedOver: number;
  remaining: number;
  note: string | null;
};

export default function LeaveClient({
  year, hireDate, recommend, balance, requests, workerId, singleStageApproval,
}: {
  year: number;
  hireDate: string | null;
  recommend: { years: number; days: number; rule: string };
  balance: Balance | null;
  requests: LeaveRequest[];
  workerId: string;
  singleStageApproval?: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  async function cancel(id: string) {
    if (!confirm('휴가 신청을 취소하시겠습니까?')) return;
    const res = await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-1">
        <Link href="/worker" className="text-accent text-2xl font-extrabold">←</Link>
        <h1 className="text-xl font-black text-ink tracking-tight">휴가신청</h1>
      </div>

      {/* 잔여 카드 (큼) */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl p-5 text-white shadow-card">
        <div className="text-xs font-mono font-extrabold tracking-widest text-cyan-100 mb-2">
          {year}년 연차 잔여
        </div>
        {balance ? (
          <>
            <div className="flex items-end gap-2 mb-3">
              <div className="text-5xl font-black">{balance.remaining.toFixed(1)}</div>
              <div className="text-base font-extrabold text-cyan-100 mb-1.5">일</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <BalanceStat label="부여" value={balance.granted.toFixed(1)} />
              <BalanceStat label="사용" value={balance.used.toFixed(1)} />
              <BalanceStat label="이월" value={balance.carriedOver.toFixed(1)} />
            </div>
            {balance.note && (
              <div className="mt-3 text-xs font-mono text-cyan-100">{balance.note}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-2xl font-black mb-1">아직 부여 안 됨</div>
            <div className="text-sm font-semibold text-cyan-100">관리자에게 연차 부여를 요청하세요.</div>
            <div className="mt-3 text-xs font-mono text-cyan-100">
              근속 {recommend.years}년 → 권장 {recommend.days}일
            </div>
          </>
        )}
      </div>

      {/* 권장/안내 */}
      {hireDate && (
        <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
          <strong className="font-extrabold">근로기준법 §60 안내</strong> · 입사일 {hireDate} 기준 근속 {recommend.years}년차 → 권장 연차 {recommend.days}일.
          <div className="mt-1 font-mono text-xs">{recommend.rule}</div>
        </div>
      )}

      {/* 신청 버튼 */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-3 rounded-xl bg-accent text-white text-sm font-extrabold shadow-card active:scale-[0.99] transition"
      >
        + 휴가 신청
      </button>

      {/* 본인 신청 내역 */}
      <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-surface-soft text-[0.8125rem] font-extrabold text-ink">
          내 신청 내역 ({requests.length})
        </div>
        <div className="divide-y divide-line max-h-[400px] overflow-y-auto">
          {requests.length === 0 && (
            <div className="px-4 py-8 text-center text-sm font-bold text-ink-muted">
              신청 내역이 없습니다.
            </div>
          )}
          {requests.map((r) => {
            const days = Math.max(1, Math.floor((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000) + 1);
            return (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded font-mono font-extrabold bg-accent-soft text-accent text-xs">
                    {LEAVE_TYPE_LABEL[r.requestType] ?? r.requestType}
                  </span>
                  <StatusBadge status={r.status} />
                  <span className="ml-auto font-mono font-extrabold text-ink text-sm">{days}일</span>
                </div>
                <div className="font-mono text-xs font-bold text-ink">
                  {r.startDate} ~ {r.endDate}
                </div>
                {r.reason && <div className="text-xs text-ink-muted mt-1">{r.reason}</div>}
                <div className="flex items-center mt-1.5">
                  <span className="text-xs font-mono text-ink-faint">
                    {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </span>
                  {r.status === 'PENDING' && (
                    <button onClick={() => cancel(r.id)} className="ml-auto text-xs font-bold text-red-600 active:underline">
                      취소
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <CreateLeaveModal workerId={workerId} balance={balance} singleStageApproval={singleStageApproval} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateLeaveModal({ workerId, balance, singleStageApproval, onClose }: {
  workerId: string;
  balance: Balance | null;
  singleStageApproval?: boolean;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    requestType: 'ANNUAL' as string,
    startDate: today,
    endDate: today,
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const isHalf = form.requestType === 'ANNUAL_HALF';
  const days = isHalf
    ? 0.5
    : Math.max(1, Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86_400_000) + 1);
  const isAnnualType = form.requestType === 'ANNUAL' || form.requestType === 'ANNUAL_HALF';
  const willBeNegative = isAnnualType && balance && balance.remaining < days;

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
      body: JSON.stringify({ workerId, ...payload }),
    });
    setSaving(false);
    if (res.ok) { alert('휴가 신청이 접수되었습니다.'); onClose(); router.refresh(); }
    else alert('실패: ' + (await res.json().catch(() => ({}))).error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-[480px] rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <h3 className="font-extrabold text-ink text-lg">휴가 신청</h3>
          <button onClick={onClose} className="ml-auto text-slate-500 text-2xl font-bold">×</button>
        </div>

        <div className="space-y-3">
          <Field label="휴가 유형">
            <select value={form.requestType}
              onChange={(e) => {
                const v = e.target.value;
                /* 반차 선택 시 endDate=startDate 동기화 */
                setForm({ ...form, requestType: v, endDate: v === 'ANNUAL_HALF' ? form.startDate : form.endDate });
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold">
              {PRIMARY_TYPES.map((k) => <option key={k} value={k}>{LEAVE_TYPE_LABEL[k]}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작일">
              <input type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: isHalf ? e.target.value : form.endDate })}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold" />
            </Field>
            <Field label={isHalf ? '종료일 (자동)' : '종료일'}>
              <input type="date" value={form.endDate} disabled={isHalf}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-white text-sm font-bold disabled:bg-slate-100" />
            </Field>
          </div>

          <div className={`px-3 py-2 rounded-lg text-xs font-bold ${willBeNegative ? 'bg-red-50 text-red-700 border border-red-300' : 'bg-accent-soft text-accent border border-accent'}`}>
            {isAnnualType && balance ? (
              <>
                요청: <span className="font-mono font-extrabold">{days}일</span> · 잔여:{' '}
                <span className="font-mono font-extrabold">{balance.remaining.toFixed(1)}일</span>
                {willBeNegative && <div className="mt-1 text-red-700">⚠ 잔여가 부족합니다. 결재 시 거부될 수 있습니다.</div>}
              </>
            ) : (
              <>요청 일수: <span className="font-mono font-extrabold">{days}일</span></>
            )}
          </div>

          <Field label="사유">
            <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="간단한 사유를 입력하세요 (선택)"
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm" />
          </Field>

          <div className="text-xs font-mono text-slate-600 px-2 py-1 bg-slate-50 rounded">
            {singleStageApproval
              ? 'ℹ 결재 흐름: 신청 → 관리자 결재 → 완료'
              : 'ℹ 결재 흐름: 신청 → 1차 결재 (관리자) → 대표 최종 결재 → 완료'}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-white border border-line text-sm font-bold">취소</button>
          <button disabled={saving} onClick={submit}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-extrabold disabled:opacity-50">
            {saving ? '신청 중…' : '신청'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-xs font-mono font-extrabold text-ink-muted mb-1'} />;
}

function BalanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 rounded-lg py-2">
      <div className="text-xs font-mono font-extrabold text-cyan-100">{label}</div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600 border-slate-300',
    IN_REVIEW: 'bg-amber-100 text-amber-700 border-amber-300',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    REJECTED: 'bg-red-100 text-red-700 border-red-300',
  };
  return <span className={`text-[0.5625rem] font-mono font-extrabold px-1.5 py-0.5 rounded border ${colors[status] ?? colors.PENDING}`}>{LEAVE_STATUS_LABEL[status] ?? status}</span>;
}
