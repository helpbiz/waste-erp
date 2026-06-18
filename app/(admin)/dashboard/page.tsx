/**
 * 메인 대시보드 — 사용자 요청 2026-05-02:
 *  - v1: "관리자 대시보드는 접수 현황만 보면 됨." → 민원 단일 포커스
 *  - v2 (2026-05-02 확장): 시설 운영 KPI 추가 — AVAC 운영자가 한 화면에서 운영 현황 파악
 */
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import MuniAggregatePanel from './_muni-aggregate-panel';
import MuniChartsPanel from './_muni-charts-panel';
import { complaintWhere, complaintTypeLabel, PENDING_STATUSES } from '@/lib/complaints';
import { safetyWhere } from '@/lib/safety';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { todayKstDate } from '@/lib/dates';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import { FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/facility';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = (await readSession())!;
  const cWhere = complaintWhere(session);
  const aWhere = contractorScopeWhere(session);
  const uWhere = userScope(session);
  const today = todayKstDate();
  const todayStart = new Date(`${today.toISOString().slice(0, 10)}T00:00:00+09:00`);

  /* 가시 가능한 시설 — contractor 산하 municipality 의 active 시설 */
  const facilityWhere: { active: boolean; municipalityId?: bigint } = { active: true };
  if (session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true },
    });
    if (c?.municipalityId) facilityWhere.municipalityId = c.municipalityId;
  } else if (session.municipalityId) {
    facilityWhere.municipalityId = BigInt(session.municipalityId);
  }

  const vlWhere = vehicleLogWhere(session);
  const sWhere = safetyWhere(session);
  const leaveWhere = session.contractorId
    ? { worker: { contractorId: BigInt(session.contractorId) } }
    : {};

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    recentComplaints, pendingCount, overdueCount, todayReceivedCount, todayCompletedCount,
    facilities, totalAssignedUsers, todayCheckIns, totalActiveWorkers,
    pendingLeaves, pendingAttendance, pendingVehicleLogs, pendingSafetyReports,
    recentVehicleLogs,
  ] = await Promise.all([
    prisma.complaint.findMany({
      where: cWhere, orderBy: { reportedAt: 'desc' }, take: 12,
      include: { assignee: { select: { name: true } } },
    }),
    prisma.complaint.count({ where: { ...cWhere, status: { in: [...PENDING_STATUSES] } } }),
    prisma.complaint.count({
      where: { ...cWhere, status: { in: [...PENDING_STATUSES] }, dueDate: { lt: new Date() } },
    }),
    prisma.complaint.count({ where: { ...cWhere, reportedAt: { gte: todayStart } } }),
    prisma.complaint.count({ where: { ...cWhere, status: 'COMPLETED', resolvedAt: { gte: todayStart } } }),
    /* 운영 KPI — 가시 시설 (contractor 의 지자체 산하) */
    prisma.wasteTreatmentFacility.findMany({
      where: facilityWhere,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        primaryUsers: { where: uWhere, select: { id: true } },
        attendances: {
          where: { workDate: today, checkInTime: { not: null } },
          select: { id: true },
        },
      },
    }),
    /* 본 contractor 산하 시설 배치된 user 수 */
    prisma.user.count({ where: { ...uWhere, primaryFacilityId: { not: null } } }),
    /* 오늘 출근 인원 (contractor 단위) */
    prisma.attendanceRecord.count({
      where: { ...aWhere, workDate: today, checkInTime: { not: null } },
    }),
    /* 활성 worker (전체 인원) */
    prisma.user.count({ where: { ...uWhere, role: 'WORKER', status: 'ACTIVE' } }),
    /* 결재 대기 카운트 */
    prisma.leaveRequest.count({ where: { ...leaveWhere, status: { in: ['PENDING', 'IN_REVIEW'] } } }),
    prisma.attendanceRecord.count({ where: { ...aWhere, status: 'PENDING' } }),
    prisma.vehicleLog.count({ where: { ...vlWhere, status: 'SUBMITTED' } }),
    prisma.safetyReport.count({ where: { ...sWhere, status: 'SUBMITTED' } }),
    /* 최근 7일 차량일지 특이사항 */
    prisma.vehicleLog.findMany({
      where: { ...vlWhere, status: { in: ['SUBMITTED', 'APPROVED'] }, logDate: { gte: sevenDaysAgo }, routeDetail: { not: null } },
      orderBy: { logDate: 'desc' },
      take: 20,
      select: {
        id: true, logDate: true, routeDetail: true, status: true,
        vehicle: { select: { vehicleNo: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  /* 차량일지 특이사항 필터링 — JSON routeDetail에서 note 또는 이상/수리점검 항목 */
  type VehicleLogAnomaly = {
    id: string;
    logDate: string;
    vehicleNo: string;
    driverName: string;
    status: string;
    note: string;
    anomalyItems: string[];
  };
  const vehicleLogAnomalies: VehicleLogAnomaly[] = [];
  for (const log of recentVehicleLogs) {
    if (!log.routeDetail) continue;
    try {
      const extra = JSON.parse(log.routeDetail);
      const anomalyItems: string[] = [];
      if (extra.inspection) {
        const labels: Record<string, string> = {
          safetyBar: '안전멈춤Bar', handSwitch: '양손조작안전스위치', dashcam: '블랙박스',
          turnSignal: '방향지시등', engineOil: '엔진오일', lubricant: '윤활제',
          brake: '브레이크', tire: '타이어', headlight: '전조등', carWash: '세차여부',
        };
        for (const [k, v] of Object.entries(extra.inspection as Record<string, string>)) {
          if (v === '이상' || v === '수리점검' || v === '아니오') {
            anomalyItems.push(`${labels[k] ?? k}(${v})`);
          }
        }
      }
      const hasNote = typeof extra.note === 'string' && extra.note.trim().length > 0;
      if (hasNote || anomalyItems.length > 0) {
        vehicleLogAnomalies.push({
          id: log.id.toString(),
          logDate: log.logDate.toISOString().slice(0, 10),
          vehicleNo: log.vehicle.vehicleNo,
          driverName: log.driver.name,
          status: log.status,
          note: extra.note ?? '',
          anomalyItems,
        });
      }
    } catch { /* JSON parse 실패 시 skip */ }
  }

  const activeFacilityCount = facilities.length;
  const attendanceRate = totalActiveWorkers > 0
    ? Math.round((todayCheckIns / totalActiveWorkers) * 100) : 0;

  /* 집하장별 실적 — AVAC 시설만, 최근 7일 합산 */
  const avacFacilityIds = facilities.filter((f) => f.type === 'AVAC').map((f) => f.id);

  const facilityOpsData = avacFacilityIds.length > 0
    ? await prisma.facilityDailyOps.groupBy({
        by: ['facilityId'],
        where: { facilityId: { in: avacFacilityIds }, opsDate: { gte: sevenDaysAgo } },
        _sum: {
          generalWasteTon: true, foodWasteTon: true,
          generalCollectTon: true, foodCollectTon: true,
          generalTransferTon: true, foodTransferTon: true,
          generalOpHours: true, foodOpHours: true,
          prevDayPowerKwh: true,
        },
        _count: { id: true },
      })
    : [];

  return (
    <div className="space-y-3.5 md:space-y-5">
      {/* MUNI_ADMIN 전용 — 위탁업체 통합 현황판 + 차트 */}
      {session.role === 'MUNI_ADMIN' && <MuniAggregatePanel />}
      {session.role === 'MUNI_ADMIN' && <MuniChartsPanel />}

      {/* KPI — 민원 위주 3종 */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 md:gap-3.5">
        <KpiCard
          label="미처리 민원"
          value={String(pendingCount)}
          unit="건"
          sub={overdueCount > 0 ? `처리기한 초과 ${overdueCount}건 포함` : '처리기한 초과 없음'}
          tone={overdueCount > 0 ? 'danger' : 'warn'}
          href="/complaints?tab=PENDING"
        />
        <KpiCard
          label="오늘 접수"
          value={String(todayReceivedCount)}
          unit="건"
          sub="자정부터 누적"
          tone="info"
          href="/complaints"
        />
        <KpiCard
          label="오늘 완료"
          value={String(todayCompletedCount)}
          unit="건"
          sub="resolvedAt 기준"
          tone="success"
          href="/complaints?tab=COMPLETED"
        />
      </section>

      {/* 결재 대기 현황 */}
      {(pendingLeaves + pendingAttendance + pendingVehicleLogs + pendingSafetyReports) > 0 && (
        <section>
          <Panel
            title="결재 대기"
            iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ApprovalItem label="휴가 신청" count={pendingLeaves} href="/users" tone="warn" />
              <ApprovalItem label="근태 조정" count={pendingAttendance} href="/attendance" tone="info" />
              <ApprovalItem label="운행일지" count={pendingVehicleLogs} href="/vehicles" tone="info" />
              <ApprovalItem label="안전보고서" count={pendingSafetyReports} href="/safety" tone="danger" />
            </div>
          </Panel>
        </section>
      )}

      {/* KPI — 시설 운영 (AVAC 시설 등록 업체만 노출) */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 md:gap-3.5">
        {avacFacilityIds.length > 0 && (
          <KpiCard
            label="처리시설 가동"
            value={String(activeFacilityCount)}
            unit="개소"
            sub={`🏭 자동집하시설 ${avacFacilityIds.length}개 포함`}
            tone="info"
            href="/super-admin?tab=facilities"
          />
        )}
        {avacFacilityIds.length > 0 && (
          <KpiCard
            label="시설 인원 배치"
            value={String(totalAssignedUsers)}
            unit="명"
            sub={totalActiveWorkers > 0 ? `전체 활성 인원 ${totalActiveWorkers}명 중` : '인원 등록 필요'}
            tone={totalAssignedUsers > 0 ? 'success' : 'warn'}
            href="/users"
          />
        )}
        <KpiCard
          label="오늘 출근"
          value={`${todayCheckIns}/${totalActiveWorkers}`}
          unit={`(${attendanceRate}%)`}
          sub={attendanceRate >= 80 ? '정상 출근율' : attendanceRate >= 50 ? '보통' : '출근 저조'}
          tone={attendanceRate >= 80 ? 'success' : attendanceRate >= 50 ? 'warn' : 'danger'}
          href="/attendance"
        />
      </section>

      {/* 시설별 운영 현황 — AVAC 시설 등록 업체만 노출 */}
      {avacFacilityIds.length > 0 && (
        <section>
          <Panel
            title="시설별 운영 현황"
            actionHref="/super-admin?tab=facilities"
            actionLabel="시설관리 →"
            iconPath="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          >
            <FacilityList facilities={facilities} />
          </Panel>
        </section>
      )}

      {/* 집하장별 실적 위젯 — AVAC 시설만 */}
      {avacFacilityIds.length > 0 && (
        <section>
          <Panel
            title="집하장별 실적 (최근 7일)"
            actionHref="/super-admin?tab=facility-ops"
            actionLabel="실적 전체보기 →"
            iconPath="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          >
            <FacilityOpsWidget
              facilities={facilities.filter((f) => f.type === 'AVAC')}
              opsData={facilityOpsData}
            />
          </Panel>
        </section>
      )}

      {/* 차량일지 특이사항 패널 */}
      {vehicleLogAnomalies.length > 0 && (
        <section>
          <Panel
            title={`차량일지 특이사항 (최근 7일 · ${vehicleLogAnomalies.length}건)`}
            actionHref="/vehicles"
            actionLabel="전체보기 →"
            iconPath="M8 17a1 1 0 01-1-1v-1a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 01-1 1H8zm-3-4V8a2 2 0 012-2h10a2 2 0 012 2v5H5zm1-6h12v5H6V7zm2 2h2v2H8V9zm5 0h2v2h-2V9z"
          >
            <VehicleLogAnomalyList items={vehicleLogAnomalies} />
          </Panel>
        </section>
      )}

      {/* 최근 민원 — 단독 패널 (full width) */}
      <section>
        <Panel
          title="최근 민원 접수 현황"
          actionHref="/complaints"
          actionLabel="민원관리 →"
          iconPath="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 002 2v6a2 2 0 002 2h2v4l.586-.586z"
        >
          <ComplaintList items={recentComplaints} />
        </Panel>
      </section>
    </div>
  );
}

/* ─────────────── 결재 대기 아이템 ─────────────── */

function ApprovalItem({
  label, count, href, tone,
}: {
  label: string; count: number; href: string; tone: 'warn' | 'danger' | 'info';
}) {
  const toneMap = {
    warn:   { bg: 'bg-amber-50 border-amber-200', num: 'text-amber-700', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    danger: { bg: 'bg-red-50 border-red-200',     num: 'text-red-700',   badge: 'bg-red-100 text-red-800 border-red-300' },
    info:   { bg: 'bg-blue-50 border-blue-200',   num: 'text-blue-700',  badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  } as const;
  const t = toneMap[tone];
  if (count === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-3 text-center opacity-50">
        <div className="text-[0.6875rem] font-extrabold text-ink-muted tracking-wide mb-1">{label}</div>
        <div className="text-xl font-black font-mono text-ink-muted">0</div>
        <div className="text-[0.625rem] font-bold text-ink-faint mt-0.5">대기 없음</div>
      </div>
    );
  }
  return (
    <Link href={href} className={`rounded-lg border ${t.bg} p-3 text-center block hover:opacity-90 active:scale-[0.98] transition`}>
      <div className="text-[0.6875rem] font-extrabold text-ink tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-black font-mono ${t.num}`}>{count}</div>
      <div className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold border ${t.badge}`}>
        결재 대기
      </div>
    </Link>
  );
}

/* ─────────────── 시설 목록 (v2 신규) ─────────────── */

type FacilityRow = {
  id: bigint;
  name: string;
  type: string;
  primaryUsers: { id: bigint }[];
  attendances: { id: bigint }[];
};

function FacilityList({ facilities }: { facilities: FacilityRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {facilities.map((f) => {
        const isAvac = f.type === 'AVAC';
        const userCount = f.primaryUsers.length;
        const todayPresent = f.attendances.length;
        const presentRate = userCount > 0 ? Math.round((todayPresent / userCount) * 100) : 0;
        const typeLabel = FACILITY_TYPE_LABELS[f.type as FacilityType] ?? f.type;
        return (
          <div key={f.id.toString()}
            className={`rounded-lg border p-3 flex items-center gap-3 ${
              isAvac ? 'bg-cyan-50 border-cyan-200' : 'bg-surface border-line'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl ${
              isAvac ? 'bg-cyan-100' : 'bg-slate-100'
            }`}>
              {isAvac ? '🏭' : '♻️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-ink truncate">{f.name}</div>
              <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">{typeLabel}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[0.6875rem] font-mono font-bold text-ink-muted">배치 / 출근</div>
              <div className="text-sm font-black font-mono text-ink">
                {userCount}<span className="text-ink-muted"> / </span>{todayPresent}
                <span className={`ml-1.5 text-[0.625rem] ${
                  presentRate >= 80 ? 'text-success'
                    : presentRate >= 50 ? 'text-warn'
                    : userCount === 0 ? 'text-ink-muted'
                    : 'text-danger'
                }`}>
                  {userCount > 0 ? `(${presentRate}%)` : '(미배치)'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── 집하장별 실적 위젯 ─────────────── */

type OpsRow = {
  facilityId: bigint;
  _sum: {
    generalWasteTon:    import('@prisma/client').Prisma.Decimal | null;
    foodWasteTon:       import('@prisma/client').Prisma.Decimal | null;
    generalCollectTon:  import('@prisma/client').Prisma.Decimal | null;
    foodCollectTon:     import('@prisma/client').Prisma.Decimal | null;
    generalTransferTon: import('@prisma/client').Prisma.Decimal | null;
    foodTransferTon:    import('@prisma/client').Prisma.Decimal | null;
    generalOpHours:     import('@prisma/client').Prisma.Decimal | null;
    foodOpHours:        import('@prisma/client').Prisma.Decimal | null;
    prevDayPowerKwh:    import('@prisma/client').Prisma.Decimal | null;
  };
  _count: { id: number };
};

function FacilityOpsWidget({
  facilities,
  opsData,
}: {
  facilities: { id: bigint; name: string }[];
  opsData: OpsRow[];
}) {
  const byFacility = new Map(opsData.map((r) => [r.facilityId.toString(), r]));
  const dec = (v: import('@prisma/client').Prisma.Decimal | null | undefined) =>
    Math.round(Number(v?.toString() ?? '0') * 10) / 10;

  if (facilities.length === 0) {
    return <div className="py-8 text-center text-sm text-ink-muted font-semibold">자동집하시설이 없습니다.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {facilities.map((f) => {
        const ops = byFacility.get(f.id.toString());
        const wasteTon    = dec(ops?._sum.generalWasteTon)    + dec(ops?._sum.foodWasteTon);
        const collectTon  = dec(ops?._sum.generalCollectTon)  + dec(ops?._sum.foodCollectTon);
        const transferTon = dec(ops?._sum.generalTransferTon) + dec(ops?._sum.foodTransferTon);
        const opHours     = dec(ops?._sum.generalOpHours)     + dec(ops?._sum.foodOpHours);
        const powerKwh    = dec(ops?._sum.prevDayPowerKwh);
        const dayCount    = ops?._count.id ?? 0;
        const noData      = dayCount === 0;

        return (
          <div key={f.id.toString()} className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🏭</span>
              <span className="text-sm font-extrabold text-ink">{f.name}</span>
              {!noData && (
                <span className="ml-auto text-[0.625rem] font-mono font-bold text-ink-muted bg-white border border-cyan-200 rounded px-1.5 py-0.5">
                  {dayCount}일치 집계
                </span>
              )}
            </div>
            {noData ? (
              <div className="py-3 text-center text-sm text-ink-muted font-semibold">최근 7일 실적 없음</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <OpsKpi label="처리량" value={wasteTon.toFixed(1)} unit="t" color="cyan" />
                <OpsKpi label="수거량" value={collectTon.toFixed(1)} unit="t" color="teal" />
                <OpsKpi label="반출량" value={transferTon.toFixed(1)} unit="t" color="emerald" />
                <OpsKpi label="가동시간" value={opHours.toFixed(1)} unit="h" color="sky" />
                <OpsKpi label="전기사용량" value={powerKwh.toFixed(0)} unit="kWh" color="indigo" colSpan={2} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OpsKpi({
  label, value, unit, color, colSpan = 1,
}: {
  label: string; value: string; unit: string; color: string; colSpan?: number;
}) {
  const bgMap: Record<string, string> = {
    cyan:    'bg-cyan-100 text-cyan-800',
    teal:    'bg-teal-100 text-teal-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    sky:     'bg-sky-100 text-sky-800',
    indigo:  'bg-indigo-100 text-indigo-800',
  };
  const cls = bgMap[color] ?? 'bg-slate-100 text-ink-muted';
  return (
    <div className={`rounded-lg p-2 text-center ${cls} ${colSpan === 2 ? 'col-span-2' : ''}`}>
      <div className="text-[0.625rem] font-extrabold tracking-wide opacity-70 mb-0.5">{label}</div>
      <div className="text-base font-black font-mono leading-none">
        {value}
        <span className="text-[0.625rem] font-semibold ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

/* ─────────────── 공통 컴포넌트 ─────────────── */

function Panel({
  title,
  actionHref,
  actionLabel,
  iconPath,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  iconPath: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl shadow-card border border-line overflow-hidden">
      <div className="px-[18px] py-3.5 border-b-2 border-line bg-surface-soft flex items-center justify-between">
        <div className="flex items-center gap-2 text-[0.875rem] font-extrabold text-ink tracking-tight">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-accent">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
          {title}
        </div>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="text-sm font-mono font-bold text-accent hover:underline">
            {actionLabel}
          </Link>
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
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone: 'success' | 'warn' | 'danger' | 'info';
  href: string;
}) {
  const accentBar =
    tone === 'warn' ? 'bg-warn'
      : tone === 'danger' ? 'bg-danger'
      : tone === 'info' ? 'bg-info'
      : 'bg-success';
  const subColor =
    tone === 'danger' ? 'text-danger'
      : tone === 'warn' ? 'text-warn'
      : tone === 'info' ? 'text-ink-muted'
      : 'text-success';

  return (
    <Link
      href={href}
      className="relative bg-surface rounded-xl shadow-card border border-line p-[18px] overflow-hidden block hover:shadow-md active:scale-[0.99] transition"
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accentBar}`} />
      <div className="text-sm font-extrabold text-ink-muted tracking-wide mb-2.5">{label}</div>
      <div className="text-[1.875rem] font-black text-ink leading-none font-mono tracking-tight">
        {value}
        {unit && <span className="text-sm font-semibold text-ink-muted ml-1.5">{unit}</span>}
      </div>
      <div className={`text-sm font-extrabold mt-2.5 font-mono ${subColor}`}>{sub}</div>
    </Link>
  );
}

/* ─────────────── 민원 목록 ─────────────── */

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
    BULKY_WASTE:  'bg-purple-100 text-purple-700',
    ILLEGAL_DUMP: 'bg-amber-100 text-warn',
    ODOR_NOISE:   'bg-blue-100 text-info',
    OTHER:        'bg-slate-100 text-ink-muted',
  };
  const iconPath: Record<string, string> = {
    PICKUP_MISS:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    BULKY_WASTE:  'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
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
    return <div className="py-10 text-center text-sm text-ink-muted font-semibold">등록된 민원이 없습니다.</div>;
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[kind]}`}>
      {children}
    </span>
  );
}

function formatTimestampKst(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

/* ─────────────── 차량일지 특이사항 목록 ─────────────── */

type VehicleLogAnomalyItem = {
  id: string;
  logDate: string;
  vehicleNo: string;
  driverName: string;
  status: string;
  note: string;
  anomalyItems: string[];
};

function VehicleLogAnomalyList({ items }: { items: VehicleLogAnomalyItem[] }) {
  const statusLabel: Record<string, string> = { SUBMITTED: '제출', APPROVED: '승인' };
  if (items.length === 0) {
    return <div className="py-6 text-center text-sm text-ink-muted font-semibold">최근 7일 특이사항 없음</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.8125rem] font-extrabold text-ink">{item.vehicleNo}</span>
              <span className="text-[0.6875rem] font-mono text-ink-muted">{item.driverName}</span>
              <span className="text-[0.6875rem] font-mono text-ink-faint">{item.logDate}</span>
            </div>
            {item.anomalyItems.length > 0 && (
              <div className="mt-0.5 text-[0.6875rem] font-bold text-amber-700">
                점검이상: {item.anomalyItems.join(' · ')}
              </div>
            )}
            {item.note && (
              <div className="mt-0.5 text-[0.6875rem] text-ink-muted font-semibold truncate">
                {item.note}
              </div>
            )}
          </div>
          <span className={`text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ${
            item.status === 'APPROVED'
              ? 'bg-green-100 text-green-700 border-green-200'
              : 'bg-amber-100 text-amber-800 border-amber-200'
          }`}>
            {statusLabel[item.status] ?? item.status}
          </span>
        </div>
      ))}
    </div>
  );
}
