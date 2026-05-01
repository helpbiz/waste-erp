/** 관리자 콘솔 사이드바 메뉴 목업 — admin layout과 동일 구조.
    role별 색상 + active 메뉴 강조. */

const ADMIN_MENU = [
  { group: 'OVERVIEW',     items: ['메인 대시보드'] },
  { group: 'CORE MODULES', items: ['민원관리', '산업안전보건', '건강기록카드'] },
  { group: 'OPERATIONS',   items: ['근태관리', '차량관리', '실적관리', '실시간 차량조회', '통계/보고서'] },
  { group: 'SETTINGS',     items: ['사용자관리', '대형폐기물 설정', '공지사항'] },
] as const;

const MUNI_MENU = [
  { group: 'OVERVIEW',     items: ['메인 대시보드'] },
  { group: 'CORE MODULES', items: ['민원관리', '산업안전보건'] },
  { group: 'OPERATIONS',   items: ['근태관리', '차량관리', '실적관리', '통계/보고서'] },
  { group: 'SETTINGS',     items: ['공지사항'] },
] as const;

export default function SidebarMock({
  active,
  variant = 'admin',
}: {
  active?: string;
  variant?: 'admin' | 'muni';
}) {
  const groups = variant === 'muni' ? MUNI_MENU : ADMIN_MENU;
  return (
    <div className="mock-sidebar" data-variant={variant}>
      <div className="mock-sidebar-brand">CleanERP</div>
      {groups.map((g) => (
        <div className="mock-sidebar-group" key={g.group}>
          <div className="mock-sidebar-group-label">{g.group}</div>
          {g.items.map((it) => (
            <div
              className="mock-sidebar-item"
              data-active={active === it}
              key={it}
            >
              {it}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
