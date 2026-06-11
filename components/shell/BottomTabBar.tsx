import type { IconKey } from './TabLink';
import { TabLink } from './TabLink';

export type BottomTabItem = {
  href: string;
  label: string;
  icon: IconKey;
  /** true: 섹션 루트 탭 — 정확히 일치할 때만 활성 */
  exact?: boolean;
};

type BottomTabBarProps = {
  items: BottomTabItem[];
};

export function BottomTabBar({ items }: BottomTabBarProps) {
  return (
    <nav
      className="flex-shrink-0 bg-surface border-t border-line shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex w-full h-16">
        {items.map((item) => (
          <TabLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            exact={item.exact}
          />
        ))}
      </div>
    </nav>
  );
}
