'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WEATHER_ALERT_TYPES,
  WEATHER_ALERT_TEMPLATES,
  WEATHER_ALERT_LABEL,
  type WeatherAlertType,
} from '@/lib/weather-alerts';

export type WorkerOpt = { id: string; name: string };

type Schedule = 'IMMEDIATE' | 'RESERVED';

const TONE: Record<string, { selected: string; idle: string }> = {
  orange: { selected: 'border-orange-500 bg-orange-50 text-orange-700',  idle: 'border-line bg-surface text-ink' },
  sky:    { selected: 'border-sky-500 bg-sky-50 text-sky-700',           idle: 'border-line bg-surface text-ink' },
  indigo: { selected: 'border-indigo-500 bg-indigo-50 text-indigo-700',  idle: 'border-line bg-surface text-ink' },
  cyan:   { selected: 'border-cyan-500 bg-cyan-50 text-cyan-700',        idle: 'border-line bg-surface text-ink' },
  violet: { selected: 'border-violet-500 bg-violet-50 text-violet-700',  idle: 'border-line bg-surface text-ink' },
  rose:   { selected: 'border-rose-500 bg-rose-50 text-rose-700',        idle: 'border-line bg-surface text-ink' },
};

export default function WeatherAlertCard({
  workers,
  hazardLevel,
}: {
  workers: WorkerOpt[];
  hazardLevel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(hazardLevel === 'DANGER' || hazardLevel === 'WARN');
  const [type, setType] = useState<WeatherAlertType>('POKYUM');
  const [message, setMessage] = useState(WEATHER_ALERT_TEMPLATES.POKYUM);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(workers.map((w) => w.id)));
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>('IMMEDIATE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; total: number; provider: string } | null>(null);

  useEffect(() => {
    /* 유형 변경 시 템플릿 자동 적용 (사용자가 편집 안 한 경우만 — ETC는 빈 값) */
    setMessage(WEATHER_ALERT_TEMPLATES[type] ?? '');
  }, [type]);

  function toggleWorker(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() { setSelectedIds(new Set(workers.map((w) => w.id))); }
  function selectNone() { setSelectedIds(new Set()); }

  async function send() {
    if (selectedIds.size === 0) {
      setError('전송 대상을 1명 이상 선택해 주세요.');
      return;
    }
    if (message.trim().length < 10) {
      setError('메시지를 10자 이상 입력해 주세요.');
      return;
    }
    if (schedule === 'RESERVED') {
      setError('예약발송은 Phase 1B에서 추가됩니다. 즉시발송으로 진행해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/safety/weather-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          workerIds: Array.from(selectedIds),
          schedule,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '발송 실패');
        return;
      }
      setResult({
        sent: data.notification.sent,
        total: data.notification.total,
        provider: data.notification.provider,
      });
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <header
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls="weather-alert-panel"
        className="px-5 py-4 bg-surface-soft border-b-2 border-line flex items-center gap-3 cursor-pointer hover:bg-surface-alt transition focus:outline-none focus:ring-2 focus:ring-accent"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-ink">기상악화 알림톡 공지</h3>
          <p className="text-xs font-bold text-ink-muted mt-0.5">기상 악화 시 카카오 알림톡으로 공지 발송</p>
        </div>
        {hazardLevel === 'DANGER' && !open && (
          <span className="px-3 py-1 rounded-full text-[10px] font-mono font-extrabold bg-red-100 text-danger border border-danger animate-pulse">
            ⚠ 위험기상 — 발송 권장
          </span>
        )}
        <span className="text-ink-muted text-xs font-mono font-bold">
          {open ? '접기 ▴' : '펼치기 ▾'}
        </span>
      </header>

      {open && (
        <div className="p-5 space-y-5">
          {/* 전송대상 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-ink">전송대상</h4>
              <span className="text-xs font-mono font-extrabold text-info">총 {workers.length}명</span>
            </div>
            <div className="bg-surface-alt rounded-lg border border-line p-3 flex items-center gap-3">
              <div className="text-sm font-extrabold text-ink">
                선택 직원 <span className="text-info">{selectedIds.size}명</span>
              </div>
              <button
                onClick={() => setShowWorkerPicker((s) => !s)}
                className="ml-auto px-3 py-1.5 rounded-md border border-line text-xs font-extrabold text-ink hover:bg-surface active:scale-95"
              >
                {showWorkerPicker ? '닫기' : '직원 선택'}
              </button>
            </div>
            {showWorkerPicker && (
              <div className="mt-2 bg-surface rounded-lg border border-line p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-extrabold text-ink">직원 선택 ({selectedIds.size}/{workers.length})</div>
                  <div className="flex gap-1.5">
                    <button onClick={selectAll} className="text-[11px] font-extrabold text-accent hover:underline">전체</button>
                    <span className="text-ink-faint">·</span>
                    <button onClick={selectNone} className="text-[11px] font-extrabold text-danger hover:underline">해제</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                  {workers.map((w) => (
                    <label
                      key={w.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm font-bold ${
                        selectedIds.has(w.id) ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:bg-surface-soft'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(w.id)}
                        onChange={() => toggleWorker(w.id)}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className="truncate">{w.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 날씨유형 선택 */}
          <div>
            <h4 className="text-sm font-extrabold text-ink mb-2">날씨유형 선택</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {WEATHER_ALERT_TYPES.map((t) => {
                const tone = TONE[t.tone] ?? TONE.rose;
                const selected = type === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={`px-3 py-3 rounded-lg border-2 text-sm font-extrabold flex items-center justify-between transition active:scale-[0.98] ${
                      selected ? tone.selected : tone.idle
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{t.emoji}</span>
                      <span>{t.label}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-current text-white border-current' : 'border-line'}`}>
                      {selected && <span className="text-[10px] font-extrabold">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 전송내용 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-ink">전송내용</h4>
              <button
                onClick={() => setMessage(WEATHER_ALERT_TEMPLATES[type] ?? '')}
                className="text-xs font-extrabold text-accent hover:underline"
                title="현재 유형의 표준 템플릿으로 초기화"
              >
                기상 유형별 전송내용 관리 ↻
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="text-[11px] font-extrabold text-ink mb-1.5">📢 [기상 안전 알림 내용]</div>
                <textarea
                  rows={9}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={type === 'ETC' ? '발송할 메시지를 직접 입력해 주세요.' : ''}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none whitespace-pre-wrap"
                />
                <div className="flex justify-between mt-1.5 text-[10px] font-mono font-bold text-ink-muted">
                  <span>{message.length} 자</span>
                  <span>{message.length > 1000 ? '⚠ 1000자 초과 — 알림톡 권장 길이 초과' : ''}</span>
                </div>
              </div>
              <aside className="bg-surface-alt rounded-lg border border-line p-4">
                <div className="text-xs font-extrabold text-ink mb-3 pb-2 border-b border-line">전송 요약</div>
                <dl className="space-y-2.5 text-[13px]">
                  <div className="flex justify-between"><dt className="font-bold text-ink-muted">유형</dt><dd className="font-extrabold text-ink">{WEATHER_ALERT_LABEL[type]}</dd></div>
                  <div className="flex justify-between"><dt className="font-bold text-ink-muted">대상</dt><dd className="font-extrabold text-info">{selectedIds.size}명</dd></div>
                  <div className="font-bold text-ink-muted">발송방식</div>
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={schedule === 'IMMEDIATE'} onChange={() => setSchedule('IMMEDIATE')} className="accent-accent" />
                      <span className="text-[13px] font-extrabold text-ink">⦿ 즉시발송</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer opacity-60">
                      <input type="radio" checked={schedule === 'RESERVED'} onChange={() => setSchedule('RESERVED')} disabled className="accent-accent" />
                      <span className="text-[13px] font-bold text-ink-muted">○ 예약발송 (예정)</span>
                    </label>
                  </div>
                </dl>
              </aside>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>
          )}
          {result && (
            <div className="bg-green-50 border border-green-300 border-l-4 border-l-success rounded-md px-3 py-2.5 text-xs font-extrabold text-success">
              ✓ {result.sent}/{result.total}명에게 발송 완료
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono ${result.provider === 'SIMULATION' ? 'bg-amber-100 text-warn' : 'bg-green-100 text-success'}`}>
                provider={result.provider}
              </span>
            </div>
          )}

          <button
            onClick={send}
            disabled={busy || selectedIds.size === 0 || message.trim().length < 10}
            className="w-full py-4 rounded-xl bg-info text-white text-base font-black shadow-card active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? '발송 중…' : (
              <>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                공지 전송
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
