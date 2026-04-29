import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { complaintWhere, PENDING_STATUSES } from '@/lib/complaints';
import { safetyWhere } from '@/lib/safety';
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

  /* 메뉴 정의 (서버에서 권한 필터링 후 클라이언트에 전달)
     OVERVIEW(메인 대시보드)는 앱에서 노출하지 않음 — 민원관리가 기본 랜딩 */
  const groups = [
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
        { href: '/live-vehicles', label: '실시간 차량조회', badge: 'LIVE' },
        { href: '/reports', label: '통계/보고서' },
      ],
    },
    ...(isInternal
      ? [
          {
            group: 'SETTINGS',
            items: [
              { href: '/users', label: '사용자관리' },
              { href: '/bulky-waste', label: '대형폐기물 설정' },
              ...(session.role === 'SUPER_ADMIN'
                ? [{ href: '/super-admin', label: '슈퍼관리자 콘솔', badge: 'ADMIN' }]
                : []),
            ],
          },
        ]
      : []),
  ];

  return (
    <ToastProvider>
      <AdminShell
        session={{ role: session.role, name: session.name }}
        groups={groups}
        pageTitle="민원관리"
        canMutate={canMutate(session.role)}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
