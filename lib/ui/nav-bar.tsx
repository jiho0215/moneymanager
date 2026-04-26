'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logout } from '@/app/(auth)/login/actions';
import { SubmitButton } from './submit-button';

export type NavItem = {
  href: string;
  icon: string;
  label: string;
};

export const KID_NAV: NavItem[] = [
  { href: '/dashboard', icon: '🏠', label: '홈' },
  { href: '/history', icon: '📊', label: '기록' },
  { href: '/learn', icon: '💸', label: '학습' },
];

export const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', icon: '🏠', label: '홈' },
  { href: '/kid-access', icon: '🔑', label: '코드' },
  { href: '/settings', icon: '⚙️', label: '설정' },
  { href: '/audit', icon: '📋', label: '활동' },
  { href: '/learn', icon: '💸', label: '학습' },
];

export function NavBar({
  items,
  brand,
  brandHref,
}: {
  items: NavItem[];
  brand: ReactNode;
  brandHref: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <Link href={brandHref} className="navbar-brand">
        {brand}
      </Link>

      <div className="navbar-items">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`navbar-link ${isActive ? 'navbar-link-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="navbar-icon" aria-hidden>{item.icon}</span>
              <span className="navbar-label">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <form action={logout} className="navbar-logout">
        <SubmitButton variant="subtle" pendingText="..." style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          로그아웃
        </SubmitButton>
      </form>
    </nav>
  );
}
