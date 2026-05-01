import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { complaintWhere, PENDING_STATUSES } from '@/lib/complaints';
import { safetyWhere } from '@/lib/safety';
import { hasFeature } from '@/lib/features';
import AdminShell from './_admin-shell';
import { ToastProvider } from '@/components/ui/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role === 'WORKER') redirect('/worker'); // WORKER는 워커앱으로

  /* 사이드바 뱃지: 미처리 민원 + 미검토 안전 보고 */
  const [pendingComplaints, pendingSafety] = await Promise.all([
    prisma.complaint.count({
      where: { ...complaintWhere(session), status: { in: [...PENDING_STATUSES] } },
    }),
    prisma.safetyReport.count({
      where: { ...safetyWhere(session), status: 'SUBMITTED' },
    }),
  ]);

  const isInternal = session.role === 'SUPER_ADMIN' || session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN';
  const canPostAnnouncement = isInternal || session.role === 'MUNI_ADMIN';

  /* 회사별 기능 권한 — sidebar 메뉴 동적 필터링 (SUPER/MUNI 는 게이트 미적용) */
  const [feLiveVehicles, feAnnouncements] = await Promise.all([
    hasFeature(session.contractorId, 'vehicleTracking'),
    hasFeature(session.contractorId, 'announcements'),
  ]);
  const feSkipForSuperOrMuni = !session.contractorId; /* SUPER/MUNI 는 모두 표시 */

  /* 메뉴 정의 (서버에서 권한 필터링 후 클라이언트에 전달).
     사용자 요청 2026-05-01: 첫 로그인 진입을 메인 대시보드로 변경 + 메뉴 첫 항목 추가. */
  const groups = [
    {
      group: 'OVERVIEW',
      items: [
        { href: '/dashboard', label: '메인 대시보드' },
      ],
    },
    {
      group: 'CORE MODULES',
      items: [
        { href: '/complaints', label: '민원관리', badge: pendingComplaints > 0 ? String(pendingComplaints) : undefined },
        { href: '/safety', label: '산업안전보건', badge: pendingSafety > 0 ? String(pendingSafety) : undefined },
        /* 인건비 정산: Clean ERP 모듈로 분리 — 향후 add-on 방식으로 지자체 옵션 적용. 메뉴는 숨김, 페이지/코드는 보존 (직접 URL 접근 가능) */
        ...(isInternal ? [{ href: '/health', label: '건강기록카드' }] : []),
      ],
    },
    {
      group: 'OPERATIONS',
      items: [
        { href: '/attendance', label: '근태관리' },
        { href: '/vehicles', label: '차량관리' },
        { href: '/performance', label: '실적관리' },
        ...(feSkipForSuperOrMuni || feLiveVehicles
          ? [{ href: '/live-vehicles', label: '실시간 차량조회', badge: 'LIVE' }]
          : []),
        { href: '/reports', label: '통계/보고서' },
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
              { href: '/users', label: '사용자관리' },
              { href: '/bulky-waste', label: '대형폐기물 설정' },
              ...(session.role === 'SUPER_ADMIN'
                ? [{ href: '/super-admin', label: '슈퍼관리자 콘솔', badge: 'ADMIN' }]
                : []),
            ],
          },
        ]
      : session.role === 'MUNI_ADMIN'
      ? [
          /* MUNI_ADMIN 도 공지 작성 가능 — 산하 회사들에 broadcast */
          {
            group: 'SETTINGS',
            items: [
              { href: '/announcements', label: '📢 공지사항' },
            ],
          },
        ]
      : []),
    /* 도움말 — role 기반 자동 라우팅. 항상 노출 (게이트 영향 없음). 새 탭 — admin shell 유지 */
    {
      group: 'HELP',
      items: [
        {
          href: session.role === 'MUNI_ADMIN' ? '/manual/muni' : '/manual/contractor',
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
