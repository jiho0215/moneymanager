'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Strips searchParams from the URL after `delayMs`. Use after a successful
 * Server Action redirect (e.g. ?deposited=20000) so the flash message
 * disappears on its own and a refresh doesn't bring it back.
 */
export function AutoCleanQuery({ delayMs = 4000 }: { delayMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(pathname);
    }, delayMs);
    return () => clearTimeout(t);
  }, [router, pathname, delayMs]);
  return null;
}
