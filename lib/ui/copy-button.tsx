'use client';

import { useState } from 'react';

export function CopyButton({ value, label = '복사', size = 'md' }: { value: string; label?: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select + execCommand
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  const isSm = size === 'sm';

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${value} 복사하기`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isSm ? '6px 12px' : '8px 16px',
        fontSize: isSm ? '0.85rem' : '0.95rem',
        fontWeight: 600,
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        background: copied ? 'var(--experiment-bg)' : 'var(--surface-2)',
        color: copied ? 'var(--experiment-deep)' : 'var(--text)',
        transition: 'background 200ms, color 200ms',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{copied ? '✓' : '📋'}</span>
      <span>{copied ? '복사됨' : label}</span>
    </button>
  );
}
