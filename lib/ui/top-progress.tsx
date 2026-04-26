'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin animated top bar that shows during route transitions.
 * Triggers on Link click via patching anchor tag handler;
 * resolves on pathname change.
 */
export function TopProgressBar() {
  const [progress, setProgress] = useState<number | null>(null);
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function start() {
      if (tickTimer.current) return;
      setProgress(8);
      tickTimer.current = setInterval(() => {
        setProgress((p) => {
          if (p === null) return null;
          if (p >= 90) return p;
          return Math.min(90, p + Math.max(1, (90 - p) * 0.07));
        });
      }, 80);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      const target = (e.target as HTMLElement | null)?.closest?.('a');
      if (!target || !(target instanceof HTMLAnchorElement)) return;
      const href = target.getAttribute('href');
      if (!href) return;
      if (href.startsWith('http://') || href.startsWith('https://')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (target.target === '_blank') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // same-origin navigation: start indicator
      start();
    }

    function onSubmit() {
      start();
    }

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      // route change complete — finish progress
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
      setProgress(100);
      const t = setTimeout(() => setProgress(null), 220);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (progress === null) return null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #16a34a, #2563eb)',
          transition: 'width 120ms ease-out',
          boxShadow: '0 0 8px rgba(37,99,235,0.6)',
        }}
      />
    </div>
  );
}
