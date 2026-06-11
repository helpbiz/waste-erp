'use client';
/**
 * 회사·지자체 관제 모드 풀스크린 클라이언트.
 *
 * 타겟 모니터: 32인치 (1920x1080 FHD), 시청 거리 1~2m (사무실 데스크 옆).
 * 50" TV 대비 폰트 ~25% 축소, 간격 컴팩트, 정보 밀도 ↑.
 *
 * UX:
 *  - 다크 배경 (slate-900)
 *  - 큰 글씨 (2~3rem) — 32" / 1.5m 가독성
 *  - 자동 풀스크린 진입 (사용자 첫 인터랙션 후)
 *  - 시계 1초 갱신
 *  - stale 인디케이터 (마지막 갱신 후 경과 초)
 */
import { useEffect, useState } from 'react';

type WallData = {
  contractorName: string | null;
  complaints: { pending: number; overdue: number; todayReceived: number; todayCompleted: number };
  ops: {
    facilityCount: number;
    avacCount: number;
    assignedUsers: number;
    totalActiveWorkers: number;
    todayCheckIns: number;
    attendanceRate: number;
  };
  facilities: Array<{
    id: string;
    name: string;
    type: string;
    userCount: number;
    todayPresent: number;
    presentRate: number;
  }>;
  recentComplaints: Array<{
    id: string;
    type: string;
    status: string;
    reportedAt: string;
    completed: boolean;
  }>;
};

type SessionInfo = { name: string; role: string; contractorId: string | null };

type WallSettings = {
  monitorSize: '32' | '40' | '50' | 'auto';
  showComplaintsKpi: boolean;
  showOpsKpi: boolean;
  showFacilities: boolean;
  showRecentComplaints: boolean;
  refreshInterval: 15 | 30 | 60 | 300;
  displayName: string | null;
};

const DEFAULT_SETTINGS: WallSettings = {
  monitorSize: '32',
  showComplaintsKpi: true,
  showOpsKpi: true,
  showFacilities: true,
  showRecentComplaints: true,
  refreshInterval: 30,
  displayName: null,
};

/* 모니터 크기별 폰트·간격 스케일 */
const SIZE_SCALE = {
  '32':   { kpiVal: 'text-3xl md:text-4xl', headTitle: 'text-3xl md:text-4xl', clock: 'text-2xl md:text-3xl', facName: 'text-lg', facRate: 'text-2xl', pad: 'p-4 md:p-6' },
  '40':   { kpiVal: 'text-4xl md:text-5xl', headTitle: 'text-4xl md:text-5xl', clock: 'text-3xl md:text-4xl', facName: 'text-xl', facRate: 'text-3xl', pad: 'p-5 md:p-8' },
  '50':   { kpiVal: 'text-5xl md:text-6xl', headTitle: 'text-4xl md:text-5xl', clock: 'text-3xl md:text-4xl', facName: 'text-2xl', facRate: 'text-3xl', pad: 'p-6 md:p-10' },
  'auto': { kpiVal: 'text-3xl md:text-5xl', headTitle: 'text-3xl md:text-5xl', clock: 'text-2xl md:text-4xl', facName: 'text-lg md:text-2xl', facRate: 'text-2xl md:text-3xl', pad: 'p-4 md:p-8' },
};

export default function WallClient({ session }: { session: SessionInfo }) {
  const [data, setData] = useState<WallData | null>(null);
  const [settings, setSettings] = useState<WallSettings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [staleSec, setStaleSec] = useState(0);

  /* 시계 1초 */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* settings 1회 fetch */
  useEffect(() => {
    fetch('/api/dashboard/wall/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.settings) setSettings(j.settings); })
      .catch(() => {/* 기본값 유지 */});
  }, []);

  /* 데이터 폴링 (refreshInterval 기반) */
  useEffect(() => {
    let abort = false;
    async function fetchData() {
      try {
        const r = await fetch('/api/dashboard/wall');
        if (!r.ok) return;
        const j = await r.json();
        if (abort) return;
        if (j && j.complaints && j.ops) {
          setData(j);
          setLastUpdate(new Date());
        }
      } catch {/* 무시 */}
    }
    fetchData();
    const t = setInterval(fetchData, settings.refreshInterval * 1000);
    return () => { abort = true; clearInterval(t); };
  }, [settings.refreshInterval]);

  /* stale 카운터 */
  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdate) {
        setStaleSec(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  /* 첫 클릭 시 풀스크린 자동 진입 (브라우저 정책상 사용자 제스처 필요) */
  useEffect(() => {
    function tryFullscreen() {
      const elem = document.documentElement;
      if (!document.fullscreenElement && elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {/* 무시 — 사용자가 거부한 경우 */});
      }
      document.removeEventListener('click', tryFullscreen);
      document.removeEventListener('keydown', tryFullscreen);
    }
    document.addEventListener('click', tryFullscreen);
    document.addEventListener('keydown', tryFullscreen);
    return () => {
      document.removeEventListener('click', tryFullscreen);
      document.removeEventListener('keydown', tryFullscreen);
    };
  }, []);

  const scopeLabel = settings.displayName
    ?? data?.contractorName
    ?? (session.role === 'SUPER_ADMIN' ? '🌐 전체 관제' : '관제 모드');
  const staleColor = staleSec < 60 ? 'text-emerald-400' : staleSec < 180 ? 'text-amber-400' : 'text-rose-400';
  const sz = SIZE_SCALE[settings.monitorSize];

  return (
    <div className={`min-h-screen bg-slate-900 text-white ${sz.pad} font-sans select-none`}>
      {/* 헤더 — 회사명 + 시계 + stale */}
      <header className="flex items-center justify-between mb-5 pb-3 border-b border-slate-700">
        <div className="flex items-baseline gap-3">
          <span className={`${sz.headTitle} font-black tracking-tight`}>{scopeLabel}</span>
          <span className="text-base text-ink-faint font-mono">관제 모드</span>
        </div>
        <div className="flex items-baseline gap-4">
          <div className="text-right">
            <div className={`${sz.clock} font-black font-mono`}>
              {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-sm text-ink-faint font-mono">
              {now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
            </div>
          </div>
          {lastUpdate && (
            <div className={`text-sm font-mono font-bold ${staleColor}`}>
              ⏱ {staleSec}s
            </div>
          )}
        </div>
      </header>

      {!data && (
        <div className="text-center text-xl text-ink-faint py-24">데이터 로딩 중…</div>
      )}

      {data && (
        <>
          {/* 민원 KPI 4종 */}
          {settings.showComplaintsKpi && (
            <section className="grid grid-cols-4 gap-3 mb-4">
              <BigKpi label="미처리 민원" value={data.complaints.pending} unit="건" valSize={sz.kpiVal}
                tone={data.complaints.overdue > 0 ? 'rose' : data.complaints.pending > 0 ? 'amber' : 'emerald'} />
              <BigKpi label="처리기한 초과" value={data.complaints.overdue} unit="건" valSize={sz.kpiVal}
                tone={data.complaints.overdue > 0 ? 'rose' : 'slate'} />
              <BigKpi label="오늘 접수" value={data.complaints.todayReceived} unit="건" valSize={sz.kpiVal} tone="cyan" />
              <BigKpi label="오늘 완료" value={data.complaints.todayCompleted} unit="건" valSize={sz.kpiVal} tone="emerald" />
            </section>
          )}

          {/* 운영 KPI 3종 */}
          {settings.showOpsKpi && (
            <section className="grid grid-cols-3 gap-3 mb-4">
              <BigKpi label="처리시설" value={data.ops.facilityCount} unit="개소" valSize={sz.kpiVal}
                sub={data.ops.avacCount > 0 ? `🏭 자동집하시설 ${data.ops.avacCount}개` : ''} tone="cyan" />
              <BigKpi label="시설 인원 배치" valSize={sz.kpiVal}
                value={`${data.ops.assignedUsers}/${data.ops.totalActiveWorkers}`} unit="명"
                tone={data.ops.assignedUsers > 0 ? 'emerald' : 'amber'} />
              <BigKpi label="오늘 출근" valSize={sz.kpiVal}
                value={`${data.ops.todayCheckIns}/${data.ops.totalActiveWorkers}`}
                unit={`(${data.ops.attendanceRate}%)`}
                tone={data.ops.attendanceRate >= 80 ? 'emerald' : data.ops.attendanceRate >= 50 ? 'amber' : 'rose'} />
            </section>
          )}

          {/* 시설별 출근율 */}
          {settings.showFacilities && data.facilities.length > 0 && (
            <section className="mb-4">
              <h2 className="text-xl font-extrabold text-slate-300 mb-2">🏭 시설별 운영 현황</h2>
              <div className="grid grid-cols-2 gap-2">
                {data.facilities.map((f) => {
                  const isAvac = f.type === 'AVAC';
                  const rateColor = f.userCount === 0 ? 'text-ink-faint'
                    : f.presentRate >= 80 ? 'text-emerald-400'
                    : f.presentRate >= 50 ? 'text-amber-400'
                    : 'text-rose-400';
                  return (
                    <div key={f.id}
                      className={`rounded-lg p-3 border flex items-center gap-3 ${
                        isAvac ? 'bg-cyan-950/40 border-cyan-700' : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <div className="text-2xl">{isAvac ? '🏭' : '♻️'}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`${sz.facName} font-extrabold truncate`}>{f.name}</div>
                        <div className="text-sm text-ink-faint font-mono">
                          배치 {f.userCount}명 · 출근 {f.todayPresent}명
                        </div>
                      </div>
                      <div className={`${sz.facRate} font-black font-mono ${rateColor}`}>
                        {f.userCount > 0 ? `${f.presentRate}%` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 최근 민원 */}
          {settings.showRecentComplaints && data.recentComplaints.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold text-slate-300 mb-2">📋 최근 민원</h2>
              <div className="space-y-1 bg-slate-800 rounded-lg p-3 border border-slate-700">
                {data.recentComplaints.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm py-0.5">
                    <span className={`px-2 py-0.5 rounded text-sm font-mono font-bold ${
                      c.completed ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'
                    }`}>
                      {c.completed ? '완료' : '진행'}
                    </span>
                    <span className="font-bold">{c.type}</span>
                    <span className="ml-auto text-sm text-ink-faint font-mono">{c.reportedAt}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="mt-5 pt-3 border-t border-slate-700 text-center text-[0.625rem] text-ink-faint font-mono">
        {settings.monitorSize === 'auto' ? '자동' : settings.monitorSize + '"'} 풀스크린 ·
        {settings.refreshInterval}s 자동 갱신 · ESC/F11 종료 · {session.name} ({session.role})
      </footer>
    </div>
  );
}

/* ─────────────── 컴포넌트 ─────────────── */

function BigKpi({
  label, value, unit, sub, tone, valSize,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
  valSize?: string;
}) {
  const colors = {
    emerald: 'border-emerald-600 bg-emerald-950/30',
    amber: 'border-amber-600 bg-amber-950/30',
    rose: 'border-rose-600 bg-rose-950/30',
    cyan: 'border-cyan-600 bg-cyan-950/30',
    slate: 'border-slate-700 bg-slate-800/50',
  };
  const valueColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
    slate: 'text-slate-300',
  };
  const valCls = valSize ?? 'text-3xl md:text-4xl';
  return (
    <div className={`rounded-lg p-3 border ${colors[tone]}`}>
      <div className="text-sm font-mono font-bold text-ink-faint uppercase tracking-wider">{label}</div>
      <div className={`${valCls} font-black font-mono mt-1 ${valueColors[tone]}`}>
        {value}
        {unit && <span className="text-base text-ink-faint ml-2">{unit}</span>}
      </div>
      {sub && <div className="text-sm text-ink-faint font-mono mt-1">{sub}</div>}
    </div>
  );
}
