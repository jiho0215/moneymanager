import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getMyKidAccount } from '@/lib/db/queries';
import { NavBar, KID_NAV } from '@/lib/ui/nav-bar';

export const dynamic = 'force-dynamic';

export default async function KidLayout({ children }: { children: ReactNode }) {
  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  return (
    <>
      <NavBar
        items={KID_NAV}
        brandHref="/dashboard"
        brand={
          <>
            <span style={{ fontSize: '1.2rem' }}>🌱</span>
            <span>{ctx.membership.display_name}</span>
          </>
        }
      />
      {children}
    </>
  );
}
