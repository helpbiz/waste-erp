import type { RoleKey } from '../_config';
import { getRole } from '../_config';

/** 역할 표시 배지 — 페이지 헤더·문맥 안내용. */
export default function RoleBadge({ role }: { role: RoleKey }) {
  const r = getRole(role);
  return (
    <span className="role-badge" data-tone={r.tone}>
      {r.label} 매뉴얼
    </span>
  );
}
