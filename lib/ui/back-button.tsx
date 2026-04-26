'use client';

import { useRouter } from 'next/navigation';

export function BackButton({ label = '← 뒤로' }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ marginBottom: 'var(--sp-3)' }}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/dashboard');
        }
      }}
    >
      {label}
    </button>
  );
}
