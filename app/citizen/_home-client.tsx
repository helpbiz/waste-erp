'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * 시민 민원앱 홈 — 도7 720 (민원 요청 관리 시점)
 *  - phone 식별 → localStorage 보존
 *  - 처리 대기 리스트 (721) + 처리 완료 리스트 (723)
 *  - 처리 완료 + 미평가 항목 → 만족도 평가 진입점 (740)
 */

type Item = {
  id: string;
  type: string;
  status: string;
  reportedAt: string;
  description: string | null;
  locationAddress: string | null;
  urgentTag: string | null;
  isUrgent: boolean;
  arrivalEta: string | null;
  resolvedAt: string | null;
  resolveNote: string | null;
  satisfactionScore: number | null;
  flaggedAsCandidate: boolean;
  completionImage: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음', OTHER: '기타',
};
const URGENT_LABEL: Record<string, string> = {
  LONG_NEGLECTED: '⏰ 오래 방치됨', ROAD_KILL: '🐾 동물 로드킬', KIDS_DANGER: '⚠️ 아이들 위험', OTHER: '✏️ 기타',
};

export default function CitizenHomeClient() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [registered, setRegistered] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'WAITING' | 'COMPLETED'>('WAITING');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = typeof window !== 'undefined' ? localStorage.getItem('citizen-phone') : '';
    const n = typeof window !== 'undefined' ? localStorage.getItem('citizen-name') : '';
    if (p) {
      setPhone(p);
      if (n) setName(n);
      setRegistered(true);
    }
  }, []);

  useEffect(() => {
    if (!registered || !phone) return;
    fetchList();
  }, [registered, phone]);

  async function fetchList() {
    setBusy(true);
    try {
      const res = await fetch(`/api/citizen/complaints?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setBusy(false);
    }
  }

  function register() {
    if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone)) {
      alert('휴대폰 번호 형식이 올바르지 않습니다 (예: 010-1234-5678)');
      return;
    }
    localStorage.setItem('citizen-phone', phone);
    if (name) localStorage.setItem('citizen-name', name);
    setRegistered(true);
  }
  function logout() {
    localStorage.removeItem('citizen-phone');
    localStorage.removeItem('citizen-name');
    setRegistered(false);
    setPhone('');
    setName('');
    setItems([]);
  }

  if (!registered) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-ink">시민 민원 신고</h1>
          <p className="text-sm font-bold text-ink-muted mt-1.5 leading-relaxed">
            폐기물 무단 투기·미수거·악취 등<br />
            현장에서 발견하면 사진 한 장으로 신고해 주세요.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs font-semibold text-amber-900 leading-relaxed">
          <strong className="font-extrabold">개인정보 안내</strong> · 휴대폰 번호는 민원 처리 결과 안내용으로만 사용되며, 처리 완료 6개월 후 자동 폐기됩니다.
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-extrabold text-ink">휴대폰 번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full px-4 py-3 rounded-lg border-2 border-line text-base font-mono font-bold focus:outline-none focus:border-accent"
          />
          <label className="block text-xs font-extrabold text-ink">성함 (선택)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full px-4 py-3 rounded-lg border-2 border-line text-base font-semibold focus:outline-none focus:border-accent"
          />
          <button onClick={register} className="w-full py-3.5 rounded-lg bg-accent text-white text-base font-black shadow-card active:scale-[0.98]">
            시작하기
          </button>
        </div>
      </div>
    );
  }

  const waiting = items.filter((i) => i.status !== 'COMPLETED' && i.status !== 'REJECTED');
  const completed = items.filter((i) => i.status === 'COMPLETED');
  const unrated = completed.filter((i) => i.satisfactionScore == null).length;

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 사용자 표시 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-extrabold text-ink">{name ? `${name}님` : '안녕하세요'}</div>
          <div className="text-[11px] font-mono font-bold text-ink-muted">{phone}</div>
        </div>
        <button onClick={logout} className="text-[11px] font-bold text-ink-faint hover:text-danger">
          전환
        </button>
      </div>

      {/* + 새 민원 신고 (큰 CTA) */}
      <Link
        href="/citizen/new"
        className="block w-full py-5 rounded-2xl bg-gradient-to-br from-accent to-cyan-700 text-white text-center shadow-card active:scale-[0.98]"
      >
        <div className="text-2xl font-black">📷 새 민원 신고</div>
        <div className="text-xs font-bold text-cyan-100 mt-1">사진 + 위치만 있으면 30초 안에</div>
      </Link>

      {/* 탭 */}
      <nav className="flex bg-surface-soft rounded-lg p-1 border border-line">
        <button
          onClick={() => setTab('WAITING')}
          className={`flex-1 py-2 rounded-md text-sm font-extrabold transition ${tab === 'WAITING' ? 'bg-surface text-accent shadow-sm' : 'text-ink-muted'}`}
        >
          처리 대기 <span className="ml-1 text-[11px] font-mono">({waiting.length})</span>
        </button>
        <button
          onClick={() => setTab('COMPLETED')}
          className={`flex-1 py-2 rounded-md text-sm font-extrabold transition ${tab === 'COMPLETED' ? 'bg-surface text-accent shadow-sm' : 'text-ink-muted'}`}
        >
          처리 완료 <span className="ml-1 text-[11px] font-mono">({completed.length}{unrated > 0 && <span className="text-warn"> · {unrated} 평가 대기</span>})</span>
        </button>
      </nav>

      {/* 리스트 */}
      <div className="space-y-2.5">
        {busy && items.length === 0 && <div className="text-center text-xs text-ink-muted py-4">불러오는 중…</div>}
        {!busy && items.length === 0 && (
          <div className="bg-surface border border-line rounded-xl py-10 text-center text-sm text-ink-muted font-bold">
            아직 신고하신 민원이 없습니다.
          </div>
        )}
        {(tab === 'WAITING' ? waiting : completed).map((c) => (
          <Link
            key={c.id}
            href={`/citizen/${c.id}`}
            className="block bg-surface border border-line rounded-xl p-4 shadow-card active:scale-[0.99] transition"
          >
            <div className="flex items-start gap-2 flex-wrap mb-1">
              <span className="text-sm font-extrabold text-ink">{TYPE_LABEL[c.type] ?? c.type}</span>
              {c.isUrgent && <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-red-100 text-danger border border-red-200">긴급</span>}
              {c.urgentTag && <span className="text-[11px] font-extrabold text-warn">{URGENT_LABEL[c.urgentTag] ?? c.urgentTag}</span>}
              <StatusChip status={c.status} />
              <code className="text-[10px] font-mono text-ink-faint ml-auto">#{c.id}</code>
            </div>
            {c.locationAddress && <div className="text-xs text-ink font-semibold">📍 {c.locationAddress}</div>}
            <div className="flex justify-between items-center mt-1.5 text-[10px] font-mono font-bold text-ink-faint">
              <span>{fmt(c.reportedAt)}</span>
              {c.status === 'COMPLETED' && c.satisfactionScore == null && (
                <span className="text-warn font-extrabold">평가 대기 →</span>
              )}
              {c.status === 'COMPLETED' && c.satisfactionScore != null && (
                <span className="text-success font-extrabold">★ {c.satisfactionScore}</span>
              )}
              {c.arrivalEta && c.status !== 'COMPLETED' && (
                <span className="text-info font-extrabold">도착 예정 {fmtTime(c.arrivalEta)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    RECEIVED:    { label: '접수',     cls: 'bg-amber-100 text-warn border-amber-200' },
    ASSIGNED:    { label: '배정',     cls: 'bg-blue-100 text-info border-blue-200' },
    IN_PROGRESS: { label: '처리중',   cls: 'bg-amber-100 text-warn border-amber-200' },
    COMPLETED:   { label: '완료',     cls: 'bg-green-100 text-success border-green-200' },
    REJECTED:    { label: '반려',     cls: 'bg-slate-100 text-ink-muted border-slate-200' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${m.cls}`}>
      {m.label}
    </span>
  );
}

function fmt(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
function fmtTime(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
