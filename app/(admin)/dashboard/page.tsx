/**
 * 메인 대시보드 — 시안(waste-erp-dashboard.html) 본문 이식
 * Plan §6.3 컴포넌트 8종 + Plan §5.1 라이트 시안 토큰 (Tailwind config 매핑)
 *
 * 데이터: 시안 단계 mock (Plan §6.5 — 실데이터 연동은 Phase 1A-2 근태 API 이후)
 */
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';
import { getTodayAttendance, type AttendanceCard } from '@/lib/attendance';
import { prisma } from '@/lib/db';
import { complaintWhere, complaintTypeLabel, isOverdue, PENDING_STATUSES } from '@/lib/complaints';
import { vehicleWhere, vehicleLogWhere } from '@/lib/vehicle-logs';
import { vehicleTypeLabel } from '@/lib/vehicle-types';
import { todayKstDate } from '@/lib/dates';
import { userScope } from '@/lib/users';
import AttendTable from './_attend-table';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = (await readSession())!;
  const readOnly = !canMutate(session.role);

  /* 실데이터 — 오늘 근태 (Phase 1A-2) */
  const att = await getTodayAttendance(session);
  const summary = att.isWorker
    ? { totalWorkers: 1, checkedIn: att.me?.checkInTime ? 1 : 0, late: 0, absent: 0, needAdjust: 0 }
    : (att.summary ?? { totalWorkers: 0, checkedIn: 0, late: 0, absent: 0, needAdjust: 0 });
  const cards: AttendanceCard[] = att.isWorker ? [] : (att.cards ?? []);
  const presentRate = summary.totalWorkers > 0
    ? Math.round((summary.checkedIn / summary.totalWorkers) * 1000) / 10
    : 0;

  /* 실데이터 — 차량 + 운행일지 (Phase 1A-3) */
  const today = todayKstDate();
  const [allVehicles, todayLogs] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhere(session),
      orderBy: { vehicleNo: 'asc' },
      include: { logs: { where: { logDate: today }, take: 1 } },
    }),
    prisma.vehicleLog.findMany({
      where: { logDate: today, ...vehicleLogWhere(session) },
      select: { wasteWeightKg: true, status: true, vehicle: { select: { vehicleNo: true } } },
    }),
  ]);
  const vehiclesRunning = allVehicles.filter((v) => v.status === 'ACTIVE' && v.logs.length > 0).length;
  const vehiclesMaint = allVehicles.filter((v) => v.status === 'MAINTENANCE').length;
  const vehiclesIdle = allVehicles.filter((v) => v.status === 'ACTIVE' && v.logs.length === 0).length;
  const vehiclesTotal = allVehicles.length;
  const wasteTotalKg = todayLogs.reduce((s, l) => s + Number(l.wasteWeightKg ?? 0), 0);
  const wasteTotalTon = wasteTotalKg / 1000;
  const wasteTargetTon = vehiclesRunning * 4; // 단순 목표 추정 (대당 4톤)
  const wastePercent = wasteTargetTon > 0 ? Math.round((wasteTotalTon / wasteTargetTon) * 1000) / 10 : 0;

  /* 실데이터 — 휴가 신청 대기 */
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: { status: 'PENDING', worker: userScope(session) },
    orderBy: { startDate: 'asc' },
    take: 6,
    include: { worker: { select: { id: true, name: true, employeeNo: true } } },
  });
  const pendingLeaveCount = await prisma.leaveRequest.count({
    where: { status: 'PENDING', worker: userScope(session) },
  });

  /* 실데이터 — 민원 (Phase 1A-3) */
  const cWhere = complaintWhere(session);
  const [recentComplaints, pendingCount, overdueCount] = await Promise.all([
    prisma.complaint.findMany({
      where: cWhere,
      orderBy: { reportedAt: 'desc' },
      take: 4,
      include: { assignee: { select: { name: true } } },
    }),
    prisma.complaint.count({
      where: { ...cWhere, status: { in: [...PENDING_STATUSES] } },
    }),
    prisma.complaint.count({
      where: {
        ...cWhere,
        status: { in: [...PENDING_STATUSES] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  /* 휴가 패널 노출 조건 — super/company/manager 권한만 */
  const showLeavePanel =
    session.role === 'SUPER_ADMIN' ||
    session.role === 'CONTRACTOR_ADMIN' ||
    session.role === 'INTERNAL_ADMIN';

  return (
    /* 사용자 요청 2026-04-28 — 새 레이아웃:
         Row 1: KPI 4 카드 (mobile 2x2 → desktop 1x4)
         Row 2: 휴가신청대기 + 시스템 알림 (mobile 1열 → desktop 2열)
         Row 3: 오늘 근태 현황 (full)
         Row 4: 최근 민원 + 차량 현황 (mobile 1열 → desktop 2열)
       원가 구성 카드 삭제. AdminShell <section> 이 이미 overflow-y-auto 이므로 PWA 스크롤 자동. */
    <div className="space-y-3.5 md:space-y-5">
      {/* Row 1: KPI — auto-fit (140px min): 폰=2col / 태블릿=3~4col / 데스크톱=4col 자동 분배 */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 md:gap-3.5">
        <KpiCard
          label="출근현황"
          value={String(summary.checkedIn)}
          unit={`/ ${summary.totalWorkers}명`}
          change={`${presentRate >= 90 ? '+' : '-'} 출근율 ${presentRate}%`}
          changeType={presentRate >= 90 ? 'up' : 'down'}
          accent="accent"
          iconPath="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <KpiCard
          label="미처리 민원"
          value={String(pendingCount)}
          unit="건"
          change={overdueCount > 0 ? `- 처리기한 초과 ${overdueCount}건 포함` : '+ 처리기한 초과 없음'}
          changeType={overdueCount > 0 ? 'down' : 'up'}
          accent="warn"
          iconPath="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        />
        <KpiCard
          label="운행차량"
          value={String(vehiclesRunning)}
          unit={`/ ${vehiclesTotal}대`}
          change={`정비중 ${vehiclesMaint} / 대기 ${vehiclesIdle}`}
          changeType="neutral"
          accent="info"
          iconPath="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
        <KpiCard
          label="금일 수집량"
          value={wasteTotalTon.toFixed(1)}
          unit="톤"
          change={wasteTargetTon > 0 ? `${wastePercent >= 100 ? '+' : '-'} 목표 대비 ${wastePercent}%` : '— 운행 차량 없음'}
          changeType={wastePercent >= 100 ? 'up' : wastePercent > 0 ? 'down' : 'neutral'}
          accent="accent"
          iconPath="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        />
      </section>

      {/* 휴가/알림 — auto-fit (300px min): 폰=1col / 태블릿+=2col 자동. */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        {showLeavePanel && (
          <Panel
            title={`휴가 신청 대기 (${pendingLeaveCount}건)`}
            action="사용자관리 >"
            iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          >
            <PendingLeavePanel
              items={pendingLeaves.map((r) => ({
                id: r.id.toString(),
                workerName: r.worker.name,
                employeeNo: r.worker.employeeNo,
                requestType: r.requestType,
                startDate: r.startDate.toISOString().slice(0, 10),
                endDate: r.endDate.toISOString().slice(0, 10),
                reason: r.reason,
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          </Panel>
        )}
        <Panel
          title="시스템 알림"
          action="전체 >"
          iconPath="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        >
          <AlertList />
        </Panel>
      </section>

      {/* Row 3: 오늘 근태 현황 (full width) */}
      <section className="grid grid-cols-1 gap-3.5">
        <Panel
          title="오늘 근태 현황"
          action="전체보기 >"
          iconPath="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        >
          <AttendStats summary={summary} />
          <AttendTable readOnly={readOnly} cards={cards} />
        </Panel>
      </section>

      {/* Row 4: 최근 민원 + 차량 현황 — auto-fit (300px min) */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        <Panel
          title="최근 민원"
          action="전체 >"
          iconPath="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        >
          <ComplaintList items={recentComplaints} />
        </Panel>

        <Panel
          title="차량 현황"
          action="상세 >"
          iconPath="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        >
          <VehiclePanel
            running={vehiclesRunning}
            maint={vehiclesMaint}
            idle={vehiclesIdle}
            vehicles={allVehicles.map((v) => ({
              no: v.vehicleNo,
              type: `${vehicleTypeLabel(v.vehicleType)} ${v.vehicleTon ?? ''}`.trim(),
              dot: v.status === 'MAINTENANCE' ? 'maint' : v.logs.length > 0 ? 'on' : 'off',
            }))}
            unsubmitted={allVehicles
              .filter((v) => v.status === 'ACTIVE' && v.logs.length === 0)
              .slice(0, 3)
              .map((v) => v.vehicleNo)}
          />
        </Panel>
      </section>
    </div>
  );
}

/* ─────────────── 공통 컴포넌트 ─────────────── */

function Panel({
  title,
  action,
  iconPath,
  children,
  className,
}: {
  title: string;
  action?: string;
  iconPath: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface rounded-xl shadow-card border border-line overflow-hidden ${className ?? ''}`}
    >
      <div className="px-[18px] py-3.5 border-b-2 border-line bg-surface-soft flex items-center justify-between">
        <div className="flex items-center gap-2 text-[0.875rem] font-extrabold text-ink tracking-tight">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-accent">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
          {title}
        </div>
        {action && (
          <span className="text-xs font-mono font-bold text-accent cursor-pointer hover:underline">
            {action}
          </span>
        )}
      </div>
      <div className="px-[18px] py-4">{children}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  change,
  changeType,
  accent,
  iconPath,
}: {
  label: string;
  value: string;
  unit?: string;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  accent: 'accent' | 'warn' | 'danger' | 'info';
  iconPath: string;
}) {
  const accentBar =
    accent === 'warn'
      ? 'bg-warn'
      : accent === 'danger'
      ? 'bg-danger'
      : accent === 'info'
      ? 'bg-info'
      : 'bg-accent';
  const iconColor =
    accent === 'warn'
      ? 'text-warn'
      : accent === 'danger'
      ? 'text-danger'
      : accent === 'info'
      ? 'text-info'
      : 'text-accent';
  const changeColor =
    changeType === 'up' ? 'text-success' : changeType === 'down' ? 'text-danger' : 'text-ink-muted';

  return (
    <div className="relative bg-surface rounded-xl shadow-card border border-line p-[18px] overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accentBar}`} />
      <svg
        width="44"
        height="44"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        className={`absolute top-4 right-4 opacity-[0.18] ${iconColor}`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <div className="text-xs font-extrabold text-ink-muted tracking-wide mb-2.5">{label}</div>
      <div className="text-[1.875rem] font-black text-ink leading-none font-mono tracking-tight">
        {value}
        {unit && <span className="text-sm font-semibold text-ink-muted ml-1.5">{unit}</span>}
      </div>
      <div className={`text-xs font-extrabold mt-2.5 font-mono flex items-center gap-1 ${changeColor}`}>
        {change}
      </div>
    </div>
  );
}

/* ─────────────── 근태 ─────────────── */

function AttendStats({ summary }: { summary: { totalWorkers: number; checkedIn: number; late: number; absent: number; needAdjust: number } }) {
  const onTime = Math.max(0, summary.checkedIn - summary.late);
  const stats = [
    { value: onTime,             label: '정상출근', tone: 'text-success' },
    { value: summary.late,       label: '지각',     tone: 'text-warn' },
    { value: summary.absent,     label: '결근',     tone: 'text-danger' },
    { value: summary.needAdjust, label: '조정필요', tone: 'text-info' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5 mb-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="text-center py-3.5 px-2 bg-surface-alt rounded-lg border border-line"
        >
          <div className={`text-2xl font-black font-mono tracking-tight ${s.tone}`}>{s.value}</div>
          <div className="text-xs font-extrabold text-ink mt-1.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatusChip({
  kind,
  children,
}: {
  kind: 'active' | 'pending' | 'alert' | 'info';
  children: React.ReactNode;
}) {
  const map = {
    active:  'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    alert:   'bg-red-100 text-red-700 border-red-200',
    info:    'bg-blue-100 text-blue-700 border-blue-200',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[kind]}`}
    >
      {children}
    </span>
  );
}

/* ─────────────── 알림 ─────────────── */

const ALERTS = [
  { kind: 'critical' as const, text: '최민준 근로자 오늘 미출근 상태입니다. 결근 처리가 필요합니다.', time: '09:31 · 근태관리' },
  { kind: 'warn'     as const, text: '민원 #2025-0423 처리기한이 1일 초과되었습니다.',                     time: '09:15 · 민원관리' },
  { kind: 'info'     as const, text: '안전점검 미제출 차량 2대 (11가1234, 11가5678)',                      time: '08:45 · 차량관리' },
  { kind: 'info'     as const, text: '김철호 근로자 이번 달 연장근로 48시간 접근 중',                       time: '08:00 · 근태관리' },
];

function AlertList() {
  const tone = {
    critical: 'border-line border-l-[4px] border-l-danger bg-red-50',
    warn:     'border-line border-l-[4px] border-l-warn bg-amber-50',
    info:     'border-line border-l-[4px] border-l-info bg-blue-50',
  };
  const dot = {
    critical: 'bg-danger',
    warn:     'bg-warn',
    info:     'bg-info',
  };
  return (
    <div className="flex flex-col gap-2">
      {ALERTS.map((a, i) => (
        <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${tone[a.kind]}`}>
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot[a.kind]}`} />
          <div className="flex-1">
            <div className="text-[0.8125rem] text-ink font-semibold leading-relaxed">{a.text}</div>
            <div className="text-[0.6875rem] text-ink-muted font-mono font-extrabold mt-1">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── 원가 ─────────────── */

function CostPanel() {
  const gauges = [
    { label: '인건비', pct: 68, tone: 'bg-accent' },
    { label: '차량비', pct: 15, tone: 'bg-accent' },
    { label: '유류비', pct: 9,  tone: 'bg-warn' },
    { label: '간접비', pct: 8,  tone: 'bg-accent' },
  ];
  const bars = [
    { month: '1월', height: 55, tone: 'bg-accent' },
    { month: '2월', height: 62, tone: 'bg-accent' },
    { month: '3월', height: 70, tone: 'bg-accent' },
    { month: '4월', height: 80, tone: 'bg-warn' },
  ];
  return (
    <>
      <div className="text-center mb-3.5">
        <div className="text-xs font-extrabold text-ink mb-1.5">이번달 총 원가 (예상)</div>
        <div className="font-mono text-[1.75rem] font-black text-accent tracking-tight">
          148,320<span className="text-sm font-bold text-ink ml-1">천원</span>
        </div>
        <div className="text-xs font-extrabold text-ink font-mono mt-1.5">톤당 원가 3,474원</div>
      </div>

      <div className="space-y-2.5">
        {gauges.map((g) => (
          <div key={g.label} className="flex items-center gap-2.5">
            <div className="text-xs font-extrabold text-ink w-16 flex-shrink-0">{g.label}</div>
            <div className="flex-1 h-2 bg-slate-300 rounded overflow-hidden">
              <div className={`h-full rounded ${g.tone}`} style={{ width: `${g.pct}%` }} />
            </div>
            <div className="text-xs font-mono font-extrabold text-ink w-11 text-right">{g.pct}%</div>
          </div>
        ))}
      </div>

      <div className="mt-3.5">
        <div className="text-xs font-mono font-extrabold text-ink mb-2.5">월별 원가 추이 (천원/톤)</div>
        <div className="flex items-end gap-2 h-[100px] py-2">
          {bars.map((b) => (
            <div key={b.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className={`w-full rounded-t ${b.tone} opacity-90 hover:opacity-100 transition`}
                style={{ height: `${b.height}%` }}
              />
              <div className="text-[0.6875rem] font-mono font-extrabold text-ink">{b.month}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────────── 민원 ─────────────── */

type ComplaintRow = {
  id: bigint;
  type: string;
  status: string;
  description: string | null;
  locationAddress: string | null;
  reportedAt: Date;
  dueDate: Date | null;
  assignee: { name: string } | null;
};

function ComplaintList({ items }: { items: ComplaintRow[] }) {
  const iconWrap = {
    PICKUP_MISS:  'bg-red-100 text-danger',
    ILLEGAL_DUMP: 'bg-amber-100 text-warn',
    ODOR_NOISE:   'bg-blue-100 text-info',
    OTHER:        'bg-slate-100 text-ink-muted',
  };
  const iconPath: Record<string, string> = {
    PICKUP_MISS:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    ILLEGAL_DUMP: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    ODOR_NOISE:   'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    OTHER:        'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  };

  function chipFor(c: ComplaintRow): { kind: 'active' | 'pending' | 'alert' | 'info'; label: string } {
    if (c.status === 'COMPLETED') return { kind: 'active', label: '완료' };
    if (c.status === 'REJECTED')  return { kind: 'info',   label: '반려' };
    if (c.dueDate && c.dueDate.getTime() < Date.now()) return { kind: 'alert', label: '초과' };
    if (c.status === 'RECEIVED' && !c.assignee)         return { kind: 'alert', label: '미배정' };
    return { kind: 'pending', label: '처리중' };
  }

  function metaFor(c: ComplaintRow): string {
    const stamp = formatTimestampKst(c.reportedAt);
    if (c.dueDate && c.dueDate.getTime() < Date.now() && c.status !== 'COMPLETED' && c.status !== 'REJECTED') {
      return `${stamp} · 처리기한 초과`;
    }
    if (c.assignee) return `${stamp} · 담당: ${c.assignee.name}`;
    return `${stamp} · 미배정`;
  }

  if (items.length === 0) {
    return <div className="py-6 text-center text-sm text-ink-muted font-semibold">등록된 민원이 없습니다.</div>;
  }

  return (
    <div>
      {items.map((c) => {
        const chip = chipFor(c);
        const wrap = iconWrap[c.type as keyof typeof iconWrap] ?? iconWrap.OTHER;
        const path = iconPath[c.type] ?? iconPath.OTHER;
        const title = `${complaintTypeLabel(c.type)}${c.locationAddress ? ' - ' + c.locationAddress : ''}`;
        return (
          <div key={c.id.toString()} className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${wrap}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={path} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.8125rem] text-ink font-bold truncate">{title}</div>
              <div className="text-[0.6875rem] text-ink-muted font-mono font-bold mt-1">{metaFor(c)}</div>
            </div>
            <StatusChip kind={chip.kind}>{chip.label}</StatusChip>
          </div>
        );
      })}
    </div>
  );
}

function formatTimestampKst(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

/* ─────────────── 차량 ─────────────── */

type VehicleVis = { no: string; type: string; dot: string };

function VehiclePanel({
  running,
  maint,
  idle,
  vehicles,
  unsubmitted,
}: {
  running: number;
  maint: number;
  idle: number;
  vehicles: VehicleVis[];
  unsubmitted: string[];
}) {
  const dotClass = {
    on: 'bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.18)]',
    maint: 'bg-warn',
    off: 'bg-ink-faint',
  };
  return (
    <>
      <div className="flex gap-4 mb-3.5 px-3 py-2.5 bg-surface-alt rounded-lg border border-line">
        <div className="text-center flex-1">
          <div className="font-mono text-[1.375rem] font-black text-success tracking-tight">{running}</div>
          <div className="text-[0.6875rem] font-extrabold text-ink mt-0.5">운행중</div>
        </div>
        <div className="text-center flex-1 border-x border-line">
          <div className="font-mono text-[1.375rem] font-black text-warn tracking-tight">{maint}</div>
          <div className="text-[0.6875rem] font-extrabold text-ink mt-0.5">정비중</div>
        </div>
        <div className="text-center flex-1">
          <div className="font-mono text-[1.375rem] font-black text-ink-muted tracking-tight">{idle}</div>
          <div className="text-[0.6875rem] font-extrabold text-ink mt-0.5">대기</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {vehicles.length === 0 && (
          <div className="col-span-3 py-4 text-center text-xs text-ink-muted font-bold">
            등록된 차량이 없습니다.
          </div>
        )}
        {vehicles.map((v) => (
          <div key={v.no} className="bg-surface-alt border border-line rounded-lg p-2.5 text-center">
            <div className="font-mono text-[0.8125rem] font-extrabold text-ink tracking-tight">{v.no}</div>
            <div className="text-[0.6875rem] font-bold text-ink-muted mt-0.5">{v.type}</div>
            <div className={`w-2 h-2 rounded-full mx-auto mt-1.5 ${dotClass[v.dot as keyof typeof dotClass] ?? dotClass.off}`} />
          </div>
        ))}
      </div>

      {unsubmitted.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-line">
          <div className="text-xs font-mono font-extrabold text-ink mb-2">금일 운행일지 미작성</div>
          <div className="flex gap-2 flex-wrap">
            {unsubmitted.map((no) => (
              <StatusChip key={no} kind="alert">{no}</StatusChip>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────── 휴가 신청 대기 ─────────────── */

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차', ANNUAL_HALF: '반차', SPECIAL: '경조사', MATERNITY: '출산',
  FAMILY_CARE: '가족돌봄', MENSTRUAL: '생리', OFFICIAL: '공가',
  SICK: '병가', BUSINESS_TRIP: '출장', TRAINING: '교육', OTHER: '기타',
};

/* MM-DD 짧은 포맷 (당해 가정) */
const shortDate = (iso: string) => iso.slice(5).replace('-', '.');

function PendingLeavePanel({
  items,
}: {
  items: Array<{
    id: string; workerName: string; employeeNo: string | null;
    requestType: string; startDate: string; endDate: string;
    reason: string | null; createdAt: string;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm font-bold text-ink-muted">
        대기 중인 휴가 신청이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((r) => {
        const isHalf = r.requestType === 'ANNUAL_HALF';
        const dayCount = Math.max(1, Math.floor((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000) + 1);
        const days = isHalf ? 0.5 : dayCount;
        const sameDay = r.startDate === r.endDate;
        const dateRange = sameDay ? shortDate(r.startDate) : `${shortDate(r.startDate)} ~ ${shortDate(r.endDate)}`;
        return (
          <div key={r.id} className="border border-line rounded-lg p-3 bg-surface-soft hover:bg-white transition">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[0.9375rem] font-extrabold text-ink truncate">{r.workerName}</span>
              <span className="text-[0.625rem] font-mono font-bold text-ink-muted">{r.employeeNo ?? '—'}</span>
              <span className="ml-auto text-[0.625rem] font-mono font-extrabold px-2 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-300">
                대기
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="px-1.5 py-0.5 rounded font-mono font-extrabold bg-accent-soft text-accent text-[0.625rem]">
                {LEAVE_TYPE_LABEL[r.requestType] ?? r.requestType}
              </span>
              <span className="ml-auto font-mono font-extrabold text-ink">{days}일</span>
            </div>
            <div className="font-mono text-[0.6875rem] text-ink-muted">
              {dateRange}
            </div>
            {r.reason && (
              <div className="text-[0.6875rem] text-ink-muted mt-1 line-clamp-1" title={r.reason}>
                {r.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
