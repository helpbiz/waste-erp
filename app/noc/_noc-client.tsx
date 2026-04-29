'use client';

/**
 * NOC 6-Zone Bento Layout — 56" 4K / 50" 디스플레이.
 * 3 columns × 2 rows = 6 zones. Header strip 위.
 *
 * 데이터 갱신:
 *  - 시계: 1초
 *  - 사용자/시스템: 30초
 *  - 차량: 5초 (고빈도)
 *  - 민원: 30초
 *
 * 색상: emerald=정상 / amber=주의 / rose=위험 / cyan=accent
 * 배경: #0a0f1e navy-black (어두운 관제실)
 */
import { useEffect, useMemo, useState } from 'react';

type SystemStats = {
  timestamp: string;
  db: { sizeMb: number | null };
  users: { total: number; active: number; locked: number; activeWithin7d: number };
  contractors: { total: number; active: number };
  municipalities: { total: number };
  login24h: { success: number; failed: number; locked: number; errorRate: number };
  auditEvents7d: number;
};

type VehiclePosition = {
  id: string;
  vehicleNo: string;
  vehicleStatus: string;
  lat: number;
  lng: number;
  speed: number;
  operationalStatus: string;
};

type MasterStats = {
  complaints: {
    total: number;
    performance: { avgResolveHours: number; overdueCount: number; overdueRate: number; urgentCount: number; unassignedCount: number; avgDepartToArriveMin: number; avgArriveToResolveMin: number };
    byStatus: Array<{ status: string; count: number }>;
    satisfaction: { avg: number; count: number };
  };
};

type GlobalUserResp = {
  total: number;
  items: Array<{ id: string; username: string; name: string; role: string; isLocked: boolean; lastLogin: string | null }>;
};

export default function NocClient({ session }: { session: { name: string; role: string } }) {
  const [now, setNow] = useState(() => new Date());
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [masterStats, setMasterStats] = useState<MasterStats | null>(null);
  const [globalUsers, setGlobalUsers] = useState<GlobalUserResp | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [staleSec, setStaleSec] = useState(0);

  /* 시계 — 1초 갱신 */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* 사용자 / 시스템 / 민원 — 30초 폴링 */
  useEffect(() => {
    let abort = false;
    async function fetchSlow() {
      try {
        const ymStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const [s, m, u] = await Promise.all([
          fetch('/api/super-admin/system-stats').then((r) => r.json()),
          fetch(`/api/reports/master-stats?from=${ymStart}&to=${today}`).then((r) => r.json()),
          fetch('/api/super-admin/users-global?page=1&limit=10&lockedOnly=false').then((r) => r.json()),
        ]);
        if (abort) return;
        setSystemStats(s);
        setMasterStats(m);
        setGlobalUsers(u);
        setLastUpdate(new Date());
      } catch {/* 무시 — stale 인디케이터가 표시 */}
    }
    fetchSlow();
    const t = setInterval(fetchSlow, 30_000);
    return () => { abort = true; clearInterval(t); };
  }, []);

  /* 차량 위치 — 5초 */
  useEffect(() => {
    let abort = false;
    async function fetchVehicles() {
      try {
        const r = await fetch('/api/live-tracking/positions');
        const j = await r.json();
        if (abort) return;
        setVehicles(j.vehicles ?? []);
      } catch {/* 무시 */}
    }
    fetchVehicles();
    const t = setInterval(fetchVehicles, 5_000);
    return () => { abort = true; clearInterval(t); };
  }, []);

  /* Stale 카운터 — 마지막 업데이트로부터 경과 초 */
  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdate) {
        setStaleSec(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const staleColor = staleSec < 30 ? 'text-emerald-400' : staleSec < 60 ? 'text-amber-400' : 'text-rose-500';
  const vehicleStats = useMemo(() => {
    const moving = vehicles.filter((v) => v.operationalStatus === 'MOVING').length;
    const stopped = vehicles.filter((v) => v.operationalStatus === 'STOP').length;
    const idle = vehicles.filter((v) => v.operationalStatus === 'IDLE').length;
    const maint = vehicles.filter((v) => v.operationalStatus === 'MAINTENANCE').length;
    return { moving, stopped, idle, maint, total: vehicles.length };
  }, [vehicles]);

  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] text-slate-100 overflow-hidden font-sans"
      style={{ fontSize: '20px' }}>
      {/* Header Strip */}
      <header className="h-[88px] bg-[#0e1530] border-b-2 border-cyan-900 flex items-center px-6 gap-6">
        <div className="text-cyan-400 font-mono font-black tabular-nums" style={{ fontSize: '56px', lineHeight: 1 }}>
          {timeStr}
        </div>
        <div className="text-slate-400" style={{ fontSize: '20px', lineHeight: 1.2 }}>
          <div>{dateStr}</div>
          <div className="text-[16px]">관제: {session.name}</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className={`text-[18px] font-mono font-bold ${staleColor}`}>
            {lastUpdate ? `갱신 ${staleSec}s 전` : '대기 중…'}
          </div>
          <div className="px-4 py-1.5 rounded bg-cyan-600 text-white font-extrabold tracking-wider" style={{ fontSize: '20px' }}>
            CleanERP NOC
          </div>
        </div>
      </header>

      {/* 6-Zone Bento Grid (3 cols × 2 rows) */}
      <div className="grid grid-cols-3 gap-3 p-3" style={{ height: 'calc(100vh - 88px)' }}>
        {/* Q1: 시스템 헬스 */}
        <Zone title="🖥 시스템 헬스">
          {!systemStats && <Loading />}
          {systemStats && (
            <div className="space-y-3">
              <BigKpi label="DB 크기" value={systemStats.db.sizeMb ? `${systemStats.db.sizeMb} MB` : '—'} tone="cyan" />
              <BigKpi label="활성 사용자" value={`${systemStats.users.active}명`} tone="emerald" />
              <BigKpi label="잠금 계정" value={`${systemStats.users.locked}건`} tone={systemStats.users.locked > 0 ? 'rose' : 'slate'} />
              <BigKpi label="7일 누적 audit" value={systemStats.auditEvents7d.toLocaleString()} tone="cyan" />
            </div>
          )}
        </Zone>

        {/* Q2: 24h 로그인 */}
        <Zone title="🔐 24h 로그인">
          {!systemStats && <Loading />}
          {systemStats && (
            <div className="space-y-3">
              <BigKpi label="성공" value={`${systemStats.login24h.success}회`} tone="emerald" />
              <BigKpi label="실패" value={`${systemStats.login24h.failed}회`} tone={systemStats.login24h.failed > 5 ? 'amber' : 'slate'} />
              <BigKpi label="자동 잠금" value={`${systemStats.login24h.locked}건`} tone={systemStats.login24h.locked > 0 ? 'rose' : 'slate'} />
              <BigKpi label="에러율" value={`${systemStats.login24h.errorRate}%`} tone={systemStats.login24h.errorRate > 20 ? 'rose' : systemStats.login24h.errorRate > 5 ? 'amber' : 'emerald'} />
            </div>
          )}
        </Zone>

        {/* Q3: 차량 운행 (Live) */}
        <Zone title="🚛 차량 Live">
          <div className="grid grid-cols-2 gap-3">
            <BigKpi label="🟢 운행" value={`${vehicleStats.moving}대`} tone="emerald" />
            <BigKpi label="🟡 정차" value={`${vehicleStats.stopped}대`} tone="amber" />
            <BigKpi label="⚪ 대기" value={`${vehicleStats.idle}대`} tone="slate" />
            <BigKpi label="🔧 정비" value={`${vehicleStats.maint}대`} tone="rose" />
          </div>
          <div className="mt-3 text-[16px] text-slate-400">
            전체 {vehicleStats.total}대 · 5초 갱신
          </div>
          <div className="mt-2 max-h-[200px] overflow-y-auto">
            {vehicles.slice(0, 8).map((v) => (
              <div key={v.id} className="flex items-center gap-2 py-1 border-b border-slate-700 text-[16px]">
                <span className={`w-2 h-2 rounded-full ${
                  v.operationalStatus === 'MOVING' ? 'bg-emerald-500' :
                  v.operationalStatus === 'STOP' ? 'bg-amber-500' :
                  v.operationalStatus === 'MAINTENANCE' ? 'bg-rose-500' : 'bg-slate-500'
                }`} />
                <span className="font-mono font-bold">{v.vehicleNo}</span>
                <span className="ml-auto text-slate-400 font-mono">{v.speed.toFixed(0)}km/h</span>
              </div>
            ))}
          </div>
        </Zone>

        {/* Q4: 민원 처리 성과 */}
        <Zone title="📋 민원 처리 성과">
          {!masterStats && <Loading />}
          {masterStats && (
            <div className="space-y-3">
              <BigKpi label="기한 초과" value={`${masterStats.complaints.performance.overdueCount}건`} unit={`${masterStats.complaints.performance.overdueRate}%`} tone={masterStats.complaints.performance.overdueCount > 0 ? 'rose' : 'emerald'} />
              <BigKpi label="긴급" value={`${masterStats.complaints.performance.urgentCount}건`} tone={masterStats.complaints.performance.urgentCount > 0 ? 'amber' : 'slate'} />
              <BigKpi label="미배정" value={`${masterStats.complaints.performance.unassignedCount}건`} tone={masterStats.complaints.performance.unassignedCount > 0 ? 'amber' : 'slate'} />
              <BigKpi label="평균 처리시간" value={`${masterStats.complaints.performance.avgResolveHours}h`} tone="cyan" />
            </div>
          )}
        </Zone>

        {/* Q5: 민원 상태 분포 */}
        <Zone title="📊 민원 단계 분포">
          {!masterStats && <Loading />}
          {masterStats && (
            <div className="space-y-2">
              {masterStats.complaints.byStatus.map((s) => {
                const max = Math.max(...masterStats.complaints.byStatus.map((x) => x.count));
                const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
                const color = s.status === 'COMPLETED' ? 'bg-emerald-500' : s.status === 'IN_PROGRESS' ? 'bg-cyan-500' : s.status === 'REJECTED' ? 'bg-slate-500' : 'bg-amber-500';
                const label = s.status === 'RECEIVED' ? '접수' : s.status === 'ASSIGNED' ? '배정' : s.status === 'IN_PROGRESS' ? '처리중' : s.status === 'COMPLETED' ? '완료' : s.status === 'REJECTED' ? '반려' : s.status;
                return (
                  <div key={s.status}>
                    <div className="flex justify-between text-[18px] mb-1">
                      <span className="font-bold">{label}</span>
                      <span className="font-mono font-extrabold text-cyan-300">{s.count}건</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-sm overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 mt-2 border-t border-slate-700 flex justify-between text-[18px]">
                <span className="text-slate-400">총 민원</span>
                <span className="font-mono font-black text-cyan-300" style={{ fontSize: '32px' }}>
                  {masterStats.complaints.total}
                </span>
              </div>
              <div className="flex justify-between text-[18px]">
                <span className="text-slate-400">만족도 평균</span>
                <span className="font-mono font-bold">
                  {masterStats.complaints.satisfaction.count > 0
                    ? `${masterStats.complaints.satisfaction.avg}/5 (${masterStats.complaints.satisfaction.count})`
                    : '—'}
                </span>
              </div>
            </div>
          )}
        </Zone>

        {/* Q6: 최근 사용자 활동 */}
        <Zone title="👥 최근 사용자 (10명)">
          {!globalUsers && <Loading />}
          {globalUsers && (
            <div className="space-y-1.5 max-h-full overflow-y-auto">
              {globalUsers.items.slice(0, 10).map((u) => (
                <div key={u.id} className={`flex items-center gap-2 py-1.5 border-b border-slate-700 ${u.isLocked ? 'bg-rose-900/30' : ''}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className="font-bold text-[18px]">{u.name}</span>
                  <span className="text-slate-400 text-[14px] font-mono">{u.role}</span>
                  <span className="ml-auto text-slate-500 text-[14px] font-mono">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              ))}
              <div className="text-[16px] text-slate-400 pt-2 mt-2 border-t border-slate-700">
                전체 {globalUsers.total}명 등록
              </div>
            </div>
          )}
        </Zone>
      </div>

      {/* 위험 알림 풀스크린 오버레이 — 잠금/긴급 발생 시 */}
      {systemStats && systemStats.login24h.locked > 0 && (
        <div className="fixed bottom-3 left-3 right-3 px-4 py-3 rounded-lg bg-rose-700/95 border-2 border-rose-400 text-white font-black animate-pulse" style={{ fontSize: '24px' }}>
          ⚠ 24h 자동 잠금 {systemStats.login24h.locked}건 발생 — 보안 점검 필요
        </div>
      )}
    </div>
  );
}

/* ─────────── 공통 컴포넌트 ─────────── */

function Zone({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0e1530] rounded-lg border border-cyan-900 overflow-hidden flex flex-col">
      <div className="px-4 py-2 bg-[#142042] border-b border-cyan-900 font-extrabold text-cyan-200" style={{ fontSize: '22px' }}>
        {title}
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

type Tone = 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';

function BigKpi({ label, value, unit, tone = 'cyan' }: { label: string; value: string; unit?: string; tone?: Tone }) {
  const colorMap: Record<Tone, string> = {
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-500',
    slate: 'text-slate-300',
  };
  const bgMap: Record<Tone, string> = {
    cyan: 'bg-cyan-900/20 border-cyan-700/30',
    emerald: 'bg-emerald-900/20 border-emerald-700/40',
    amber: 'bg-amber-900/30 border-amber-600/50',
    rose: 'bg-rose-900/40 border-rose-500/60 border-l-[6px] border-l-rose-500',
    slate: 'bg-slate-800/40 border-slate-700/40',
  };
  return (
    <div className={`px-3 py-2.5 rounded border ${bgMap[tone]}`}>
      <div className="text-slate-400 font-bold" style={{ fontSize: '16px' }}>{label}</div>
      <div className={`font-mono font-black tabular-nums ${colorMap[tone]}`} style={{ fontSize: '40px', lineHeight: 1 }}>
        {value}
        {unit && <span className="ml-2 font-bold opacity-70" style={{ fontSize: '20px' }}>{unit}</span>}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="text-center py-8 text-slate-500" style={{ fontSize: '20px' }}>
      📡 데이터 로딩 중…
    </div>
  );
}
