'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MIN_VISIBLE_MS = 280;

export function TopProgressBar() {
  const [progress, setProgress] = useState<number | null>(null);
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    function start() {
      if (tickTimer.current) return;
      startedAt.current = Date.now();
      setProgress(30);
      tickTimer.current = setInterval(() => {
        setProgress((p) => {
          if (p === null) return null;
          if (p >= 90) return p;
          return Math.min(90, p + Math.max(1, (90 - p) * 0.08));
        });
      }, 100);
    }

    function isInternalAnchorClick(e: MouseEvent): HTMLAnchorElement | null {
      if (e.defaultPrevented || e.button !== 0) return null;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
      const target = (e.target as HTMLElement | null)?.closest?.('a');
      if (!target || !(target instanceof HTMLAnchorElement)) return null;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#')) return null;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          if (new URL(href).origin !== window.location.origin) return null;
        } catch { return null; }
      }
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return null;
      if (target.target === '_blank') return null;
      return target;
    }

    function onClick(e: MouseEvent) {
      const a = isInternalAnchorClick(e);
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }

    function onSubmit() {
      start();
    }

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('submit', onSubmit, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as AddEventListenerOptions);
      document.removeEventListener('submit', onSubmit, { capture: true } as AddEventListenerOptions);
    };
  }, []);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      const elapsed = Date.now() - (startedAt.current || Date.now());
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

      const finish = () => {
        if (tickTimer.current) {
          clearInterval(tickTimer.current);
          tickTimer.current = null;
        }
        setProgress(100);
        setTimeout(() => setProgress(null), 240);
      };

      if (wait > 0) {
        const t = setTimeout(finish, wait);
        return () => clearTimeout(t);
      }
      finish();
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
        height: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #16a34a 0%, #2563eb 60%, #ec4899 100%)',
          transition: 'width 180ms ease-out',
          boxShadow: '0 0 12px rgba(37,99,235,0.7)',
        }}
      />
    </div>
  );
}
