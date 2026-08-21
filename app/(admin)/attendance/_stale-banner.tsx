'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

type StaleItem = {
  id: string;
  workDate: string;
  workerName: string;
  employeeNo: string | null;
  checkInTime: string | null;
  daysStale: number;
};

/** datetime-local 입력용 기본값 — 출근시각+8시간(없으면 근무일 09시)을 로컬시각 문자열로 */
function defaultCheckoutLocal(item: StaleItem): string {
  const base = item.checkInTime ? new Date(item.checkInTime) : new Date(`${item.workDate}T09:00:00+09:00`);
  const guess = item.checkInTime ? new Date(base.getTime() + 8 * 60 * 60 * 1000) : base;
  const kst = new Date(guess.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

export default function StaleAttendanceBanner() {
  const toast = useToast();
  const [items, setItems] = useState<StaleItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [checkoutAt, setCheckoutAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/stale')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  function openRow(item: StaleItem) {
    setOpenId(item.id);
    setCheckoutAt(defaultCheckoutLocal(item));
    setReason('');
  }

  async function confirmClose(item: StaleItem) {
    if (!checkoutAt) { toast.warning('퇴근 시각을 입력해 주세요.'); return; }
    if (reason.trim().length < 2) { toast.warning('사유를 2자 이상 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/${item.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustedCheckOut: new Date(`${checkoutAt}:00+09:00`).toISOString(),
          reason,
          adjustmentType: 'CORRECTION',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? '마감 처리에 실패했습니다.');
        return;
      }
      toast.success(`${item.workerName}님 ${item.workDate} 근태를 마감했습니다.`);
      setItems((prev) => (prev ?? []).filter((r) => r.id !== item.id));
      setOpenId(null);
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-red-50 border-2 border-red-300 border-l-4 border-l-red-600 rounded-xl px-4 py-3 space-y-2">
      <div className="text-sm font-extrabold text-red-800">
        ⚠️ 퇴근 미마감 {items.length}건 — 근로자 화면에는 하루 지나면 더 이상 노출되지 않습니다
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="bg-surface rounded-lg border border-red-200">
            <div className="flex items-center justify-between px-3 py-2 gap-2">
              <div className="text-sm">
                <span className="font-extrabold text-ink">{item.workerName}</span>
                <span className="text-ink-faint font-mono ml-1">({item.employeeNo ?? '—'})</span>
                <span className="text-ink-muted ml-2">{item.workDate} 출근 · {item.daysStale}일 경과</span>
              </div>
              <button
                onClick={() => (openId === item.id ? setOpenId(null) : openRow(item))}
                className="text-sm font-extrabold text-accent hover:underline whitespace-nowrap"
              >
                {openId === item.id ? '닫기' : '마감 처리'}
              </button>
            </div>
            {openId === item.id && (
              <div className="px-3 pb-3 pt-1 border-t border-red-100 flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold text-ink-muted">
                  퇴근 시각
                  <input
                    type="datetime-local"
                    value={checkoutAt}
                    onChange={(e) => setCheckoutAt(e.target.value)}
                    className="block mt-1 px-2 py-1.5 rounded-md border border-line text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-ink-muted flex-1 min-w-[180px]">
                  사유
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="예: 퇴근 등록 누락으로 관리자 마감"
                    className="block mt-1 w-full px-2 py-1.5 rounded-md border border-line text-sm"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => confirmClose(item)}
                  className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-extrabold hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? '처리 중…' : '확정'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
