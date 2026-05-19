import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';
import { canManageUsers } from '@/lib/users';
import { prisma } from '@/lib/db';
import { complaintWhere, PENDING_STATUSES } from '@/lib/complaints';
import { safetyWhere } from '@/lib/safety';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { contractorScopeWhere } from '@/lib/scopes';
import { hasFeature } from '@/lib/features';
import AdminShell from './_admin-shell';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');

  // WORKER 역할: isNoticeManager / isComplaintManager / isPayrollManager 여부 확인 후 분기
  let isNoticeManagerWorker = false;
  let isComplaintManagerWorker = false;
  let isPayrollManagerWorker = false;
  if (session.role === 'WORKER') {
    const meFlag = await prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { isNoticeManager: true, isComplaintManager: true, isPayrollManager: true },
    });
    isNoticeManagerWorker = meFlag?.isNoticeManager === true;
    isComplaintManagerWorker = meFlag?.isComplaintManager === true;
    isPayrollManagerWorker = meFlag?.isPayrollManager === true;
    if (!isNoticeManagerWorker && !isComplaintManagerWorker && !isPayrollManagerWorker) redirect('/worker');
  }

  /* 사이드바 뱃지: 미처리 민원 + 미검토 안전 보고 + 미결재 */
  const isManager = canManageUsers(session.role);
  const aWhere = contractorScopeWhere(session);
  const vlWhere = vehicleLogWhere(session);
  const leaveWhere = session.contractorId
    ? { worker: { contractorId: BigInt(session.contractorId) } }
    : {};

  const [pendingComplaints, pendingSafety, pendingLeaves, pendingAttendance, pendingVehicleLogs, pendingSafetyApprovals] = await Promise.all([
    prisma.complaint.count({
      where: { ...complaintWhere(session), status: { in: [...PENDING_STATUSES] } },
    }),
    prisma.safetyReport.count({
      where: { ...safetyWhere(session), status: 'SUBMITTED' },
    }),
    isManager ? prisma.leaveRequest.count({ where: { ...leaveWhere, status: { in: ['PENDING', 'IN_REVIEW'] } } }) : Promise.resolve(0),
    isManager ? prisma.attendanceRecord.count({ where: { ...aWhere, status: 'PENDING' } }) : Promise.resolve(0),
    isManager ? prisma.vehicleLog.count({ where: { ...vlWhere, status: 'SUBMITTED' } }) : Promise.resolve(0),
    isManager ? prisma.safetyReport.count({ where: { ...safetyWhere(session), status: 'SUBMITTED' } }) : Promise.resolve(0),
  ]);
  const pendingApprovals = pendingLeaves + pendingAttendance + pendingVehicleLogs + pendingSafetyApprovals;

  const isInternal = session.role === 'SUPER_ADMIN' || session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN';
  const canPostAnnouncement = isInternal || session.role === 'MUNI_ADMIN';

  /* 회사별 기능 권한 — sidebar 메뉴 동적 필터링 (SUPER/MUNI 는 게이트 미적용) */
  const [feLiveVehicles, feAnnouncements, feWorkerSuggestion, feNocAccess, fePayslip] = await Promise.all([
    hasFeature(session.contractorId, 'vehicleTracking'),
    hasFeature(session.contractorId, 'announcements'),
    hasFeature(session.contractorId, 'workerSuggestion'),
    hasFeature(session.contractorId, 'nocAccess'),  /* Agent Team 합의 2026-05-02 */
    hasFeature(session.contractorId, 'payslip'),
  ]);
  const feSkipForSuperOrMuni = !session.contractorId; /* SUPER/MUNI 는 모두 표시 */

  /* 메뉴 정의 (서버에서 권한 필터링 후 클라이언트에 전달).
     사용자 요청 2026-05-01: 첫 로그인 진입을 메인 대시보드로 변경 + 메뉴 첫 항목 추가.
     사용자 요청 2026-05-20: MUNI_ADMIN 전용 메뉴를 완전히 분리 (불필요 메뉴 제거). */

  /* ── MUNI_ADMIN 전용 메뉴 ──────────────────────────────────────────────── */
  if (session.role === 'MUNI_ADMIN') {
    const muniGroups = [
      {
        group: 'OVERVIEW',
        items: [
          { href: '/dashboard', label: '메인 대시보드' },
          { href: '/dashboard/wall', label: '🖥 관제모드', newTab: true },
          { href: '/dashboard/wall/settings', label: '🛠 관제모드 설정' },
        ],
      },
      {
        group: 'MANAGEMENT',
        items: [
          { href: '/announcements', label: '📢 공지사항' },
          { href: '/complaints', label: '민원관리', badge: pendingComplaints > 0 ? String(pendingComplaints) : undefined },
          { href: '/safety', label: '산업안전보건', badge: pendingSafety > 0 ? String(pendingSafety) : undefined },
          { href: '/attendance', label: '근태관리' },
          { href: '/live-vehicles', label: '실시간 차량조회', badge: 'LIVE' as string },
          { href: '/reports', label: '통합/보고서' },
        ],
      },
    ];

    return (
      <ToastProvider>
        <AdminShell
          session={{ role: session.role, name: session.name }}
          groups={muniGroups}
          pageTitle="메인 대시보드"
          canMutate={canMutate(session.role)}
        >
          {children}
        </AdminShell>
      </ToastProvider>
    );
  }

  /* ── 일반(위탁업체·슈퍼·근로자) 메뉴 ────────────────────────────────────── */
  const groups = [
    {
      group: 'OVERVIEW',
      items: [
        { href: '/dashboard', label: '메인 대시보드' },
        ...(session.role === 'SUPER_ADMIN' || feNocAccess
          ? [
              { href: '/dashboard/wall', label: '🖥 관제 모드 (풀스크린)', newTab: true },
              { href: '/dashboard/wall/settings', label: '🛠 관제 모드 설정' },
            ]
          : []),
        ...(session.role === 'SUPER_ADMIN'
          ? [{ href: '/noc', label: '🌐 글로벌 NOC', newTab: true }]
          : []),
      ],
    },
    {
      group: 'CORE MODULES',
      items: [
        { href: '/complaints', label: '민원관리', badge: pendingComplaints > 0 ? String(pendingComplaints) : undefined },
        { href: '/safety', label: '산업안전보건', badge: pendingSafety > 0 ? String(pendingSafety) : undefined },
        ...(isInternal ? [{ href: '/health', label: '건강기록카드' }] : []),
        ...(feSkipForSuperOrMuni || feWorkerSuggestion
          ? [{ href: '/suggestions', label: '🗳 익명 건의함' }]
          : []),
      ],
    },
    {
      group: 'OPERATIONS',
      items: [
        { href: '/approvals', label: '📋 결재관리', badge: pendingApprovals > 0 ? String(pendingApprovals) : undefined },
        { href: '/attendance', label: '근태관리' },
        { href: '/punch-restrictions', label: '출퇴근 제한 설정' },
        { href: '/vehicles', label: '차량관리' },
        { href: '/performance', label: '실적관리' },
        ...(feSkipForSuperOrMuni || feLiveVehicles
          ? [{ href: '/live-vehicles', label: '실시간 차량조회', badge: 'LIVE' }]
          : []),
        { href: '/reports', label: '통계/보고서' },
        { href: '/print', label: '🖨 출력 센터' },
        ...(isInternal && (feSkipForSuperOrMuni || fePayslip)
          ? [{ href: '/payroll', label: '💰 급여관리' }]
          : []),
      ],
    },
    ...(isInternal
      ? [
          {
            group: 'SETTINGS',
            items: [
              ...(feSkipForSuperOrMuni || feAnnouncements
                ? [{ href: '/announcements', label: '📢 공지사항' }]
                : []),
              ...(session.role !== 'SUPER_ADMIN'
                ? [{ href: '/settings/info', label: '🏢 회사 정보 설정' }]
                : []),
              { href: '/users', label: '사용자관리' },
              { href: '/import', label: '📥 일괄 업로드' },
              { href: '/settings/disposal-sites', label: '🏭 반입장소 설정' },
              { href: '/settings/zones', label: '🗺 담당구역 설정' },
              { href: '/bulky-waste', label: '대형폐기물 설정' },
              ...(session.role === 'SUPER_ADMIN'
                ? [{ href: '/super-admin', label: '슈퍼관리자 콘솔', badge: 'ADMIN' }]
                : []),
            ],
          },
        ]
      : (isNoticeManagerWorker || isComplaintManagerWorker || isPayrollManagerWorker)
      ? [
          {
            group: 'SETTINGS',
            items: [
              ...(isComplaintManagerWorker ? [{ href: '/complaints', label: '민원관리' }] : []),
              ...(isNoticeManagerWorker ? [{ href: '/announcements', label: '📢 공지사항' }] : []),
              ...(isPayrollManagerWorker ? [{ href: '/payroll', label: '💰 급여관리' }] : []),
            ],
          },
        ]
      : []),
    {
      group: 'HELP',
      items: [
        { href: '/profile', label: '🔑 비밀번호 변경' },
        {
          href: '/manual/contractor',
          label: '📘 사용 가이드',
          newTab: true,
        },
      ],
    },
  ];

  return (
    <ToastProvider>
      <AdminShell
        session={{ role: session.role, name: session.name }}
        groups={groups}
        pageTitle="메인 대시보드"
        canMutate={canMutate(session.role)}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
