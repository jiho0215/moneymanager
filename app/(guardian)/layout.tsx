import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { NavBar, GUARDIAN_NAV } from '@/lib/ui/nav-bar';

export const dynamic = 'force-dynamic';

export default async function GuardianLayout({ children }: { children: ReactNode }) {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  return (
    <>
      <NavBar
        items={GUARDIAN_NAV}
        brandHref="/guardian"
        brand={
          <>
            <span style={{ fontSize: '1.2rem' }}>👨‍👩‍👧</span>
            <span>{ctx.guardian.display_name}</span>
          </>
        }
      />
      {children}
    </>
  );
}
