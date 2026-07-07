'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dealer/help', label: '📖 사용법' },
  { href: '/dealer/leads', label: '리드 등록' },
  { href: '/dealer/demo', label: '영업 데모' },
  { href: '/dealer/profile', label: '🔑 내 계정' },
];

export default function DealerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4">
      {LINKS.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'font-semibold text-blue-700 underline' : 'text-ink-muted hover:text-blue-700'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
