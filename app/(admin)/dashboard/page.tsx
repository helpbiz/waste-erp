/**
 * 메인 대시보드 — 사용자 요청 2026-05-02:
 *  "관리자 대시보는 접수 현황만 보면 됨." → 민원 접수 현황 단일 포커스로 단순화.
 *
 *  이전 구성(KPI 4종 + 휴가/근태/차량/시스템알림)은 사이드바 각 메뉴
 *  (근태관리·차량관리·사용자관리·공지사항)에서 확인 가능하므로 dashboard 에서는 제거.
 *  유지: 민원 KPI 3종 + 최근 민원 목록.
 */
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { complaintWhere, complaintTypeLabel, PENDING_STATUSES } from '@/lib/complaints';
import { todayKstDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = (await readSession())!;
  const cWhere = complaintWhere(session);
  const today = todayKstDate();
  const todayStart = new Date(`${today.toISOString().slice(0, 10)}T00:00:00+09:00`);

  const [recentComplaints, pendingCount, overdueCount, todayReceivedCount, todayCompletedCount] = await Promise.all([
    prisma.complaint.findMany({
      where: cWhere,
      orderBy: { reportedAt: 'desc' },
      take: 12,
      include: { assignee: { select: { name: true } } },
    }),
    prisma.complaint.count({ where: { ...cWhere, status: { in: [...PENDING_STATUSES] } } }),
    prisma.complaint.count({
      where: {
        ...cWhere,
        status: { in: [...PENDING_STATUSES] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.complaint.count({ where: { ...cWhere, reportedAt: { gte: todayStart } } }),
    prisma.complaint.count({
      where: {
        ...cWhere,
        status: 'COMPLETED',
        resolvedAt: { gte: todayStart },
      },
    }),
  ]);

  return (
    <div className="space-y-3.5 md:space-y-5">
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

      {/* 최근 민원 — 단독 패널 (full width) */}
      <section>
        <Panel
          title="최근 민원 접수 현황"
          actionHref="/complaints"
          actionLabel="민원관리 →"
          iconPath="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        >
          <ComplaintList items={recentComplaints} />
        </Panel>
      </section>
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
          <Link href={actionHref} className="text-xs font-mono font-bold text-accent hover:underline">
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
      <div className="text-xs font-extrabold text-ink-muted tracking-wide mb-2.5">{label}</div>
      <div className="text-[1.875rem] font-black text-ink leading-none font-mono tracking-tight">
        {value}
        {unit && <span className="text-sm font-semibold text-ink-muted ml-1.5">{unit}</span>}
      </div>
      <div className={`text-xs font-extrabold mt-2.5 font-mono ${subColor}`}>{sub}</div>
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
