'use client';

import { useFormStatus } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';

export type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: ReactNode;
  style?: CSSProperties;
  variant?: 'primary' | 'success' | 'warn' | 'subtle' | 'danger';
};

const VARIANTS: Record<NonNullable<SubmitButtonProps['variant']>, CSSProperties> = {
  primary: { backgroundColor: '#2563eb', color: 'white' },
  success: { backgroundColor: '#16a34a', color: 'white' },
  warn: { backgroundColor: '#ff9800', color: 'white' },
  subtle: { backgroundColor: '#6b7280', color: 'white' },
  danger: { backgroundColor: '#dc2626', color: 'white' },
};

export function SubmitButton({
  children,
  pendingText = '처리 중...',
  style = {},
  variant = 'primary',
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      style={{
        padding: '12px',
        border: 'none',
        borderRadius: '6px',
        fontSize: '1rem',
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 150ms',
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {pending ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Spinner />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'spin 0.8s linear infinite' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </svg>
  );
}
