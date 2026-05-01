/** 모바일 앱바 목업 — 실제 워커앱 헤더와 같은 구조 + 더 큰 글자.
    role 별 색상 (worker=teal, admin=navy, muni=blue) 자동 적용. */
export default function AppBarMock({
  title,
  role = 'worker',
  showBack = false,
}: {
  title: string;
  role?: 'worker' | 'admin' | 'muni';
  showBack?: boolean;
}) {
  return (
    <div className="mock-appbar" data-role={role}>
      {showBack && <span className="mock-appbar-back" aria-hidden>←</span>}
      <span className="mock-appbar-title">{title}</span>
    </div>
  );
}
