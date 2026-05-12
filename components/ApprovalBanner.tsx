'use client';

/**
 * 결재 대기 알림 — 관리자 접속 시 미결재 문서 존재하면 팝업 + TTS.
 * - 마운트 시 1회 fetch → 미결재 있으면 모달 자동 오픈
 * - 60초마다 폴링 (새 결재 건 추가 감지)
 * - sessionStorage 로 세션 내 중복 알림 억제 (count가 증가하면 재알림)
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadVoiceSettings } from '@/lib/voice-settings';

type PendingCounts = {
  leaves: number;
  attendance: number;
  vehicleLogs: number;
  safetyReports: number;
  total: number;
};

const SESSION_KEY = 'cleanerp:approval-notified-count';

function getNotifiedCount(): number {
  try { return parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function setNotifiedCount(n: number) {
  try { sessionStorage.setItem(SESSION_KEY, String(n)); } catch { /* */ }
}

function speakApproval(total: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const settings = loadVoiceSettings();
  if (!settings.enabled) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(
    `결재 대기 문서가 ${total}건 있습니다. 확인이 필요합니다.`
  );
  u.lang = 'ko-KR';
  u.rate = 1.0;
  u.pitch = settings.gender === 'male' ? 0.85 : 1.15;
  try { window.speechSynthesis.speak(u); } catch { /* */ }
}

export default function ApprovalBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<PendingCounts | null>(null);
  const prevTotal = useRef(0);

  const isAdminPath = pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/complaints') ||
    pathname?.startsWith('/attendance') ||
    pathname?.startsWith('/vehicles') ||
    pathname?.startsWith('/safety') ||
    pathname?.startsWith('/users') ||
    pathname?.startsWith('/reports') ||
    pathname?.startsWith('/approvals') ||
    pathname?.startsWith('/performance') ||
    pathname?.startsWith('/punch-restrictions') ||
    pathname?.startsWith('/announcements') ||
    pathname?.startsWith('/super-admin') ||
    pathname?.startsWith('/profile');

  async function fetchCounts() {
    try {
      const res = await fetch('/api/approvals/pending', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as PendingCounts;
      setCounts(data);

      if (data.total > 0) {
        const lastNotified = getNotifiedCount();
        if (data.total > lastNotified) {
          setNotifiedCount(data.total);
          prevTotal.current = data.total;
          setOpen(true);
          speakApproval(data.total);
        }
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!isAdminPath) return;
    fetchCounts();
    const t = setInterval(fetchCounts, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open || !counts || counts.total === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 flex items-center justify-center px-4"
      onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border-2 border-amber-400 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-amber-400 px-5 py-3 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h3 className="text-base font-extrabold text-amber-900 flex-1">결재 대기 문서 알림</h3>
          <button onClick={() => setOpen(false)} className="text-xl font-bold text-amber-800">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-slate-700">
            결재가 필요한 문서가 <span className="text-amber-600 font-extrabold text-lg">{counts.total}건</span> 있습니다.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {counts.leaves > 0 && (
              <CountChip label="휴가 신청" count={counts.leaves} tone="warn" />
            )}
            {counts.attendance > 0 && (
              <CountChip label="근태 조정" count={counts.attendance} tone="info" />
            )}
            {counts.vehicleLogs > 0 && (
              <CountChip label="운행일지" count={counts.vehicleLogs} tone="info" />
            )}
            {counts.safetyReports > 0 && (
              <CountChip label="안전보고서" count={counts.safetyReports} tone="danger" />
            )}
          </div>
        </div>
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => { setOpen(false); router.push('/approvals'); }}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-extrabold text-sm hover:bg-amber-600 active:scale-[0.98] transition"
          >
            결재 관리 바로가기 →
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}

function CountChip({ label, count, tone }: { label: string; count: number; tone: 'warn' | 'info' | 'danger' }) {
  const cls = tone === 'warn'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : tone === 'danger'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${cls}`}>
      <span className="text-xs font-bold">{label}</span>
      <span className="text-base font-black font-mono">{count}</span>
    </div>
  );
}
