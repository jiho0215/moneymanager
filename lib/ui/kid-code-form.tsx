'use client';

import { useEffect, useState } from 'react';
import { loginAsKidWithCode } from '@/app/(auth)/login/actions';
import { SubmitButton } from './submit-button';

const STORAGE_KEY = 'cls_kid_codes_v1';
const MAX_REMEMBERED = 5;

type RememberedCode = { code: string; lastUsedAt: number };

function loadCodes(): RememberedCode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x?.code === 'string' && /^[A-Z0-9]{6}$/.test(x.code))
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

function saveCode(code: string) {
  if (typeof window === 'undefined') return;
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return;
  const existing = loadCodes().filter((c) => c.code !== cleaned);
  const next = [{ code: cleaned, lastUsedAt: Date.now() }, ...existing].slice(0, MAX_REMEMBERED);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

function removeCode(code: string) {
  if (typeof window === 'undefined') return;
  const next = loadCodes().filter((c) => c.code !== code);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function KidCodeForm() {
  const [remembered, setRemembered] = useState<RememberedCode[]>([]);
  const [code, setCode] = useState('');

  useEffect(() => {
    setRemembered(loadCodes());
  }, []);

  function handleChip(c: string) {
    setCode(c);
  }

  function handleForget(c: string) {
    removeCode(c);
    setRemembered(loadCodes());
  }

  function handleSubmit() {
    if (code.trim().length === 6) saveCode(code);
  }

  return (
    <div className="stack-3">
      {remembered.length > 0 && (
        <div>
          <div className="soft" style={{ marginBottom: 8 }}>📌 저장된 코드 — 눌러서 자동 입력</div>
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            {remembered.map((c) => (
              <div
                key={c.code}
                className="row gap-2"
                style={{
                  padding: '6px 8px 6px 14px',
                  background: 'var(--experiment-bg)',
                  border: '1px solid var(--experiment)',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: 'var(--experiment-deep)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleChip(c.code)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontWeight: 'inherit',
                    letterSpacing: 'inherit',
                    fontSize: '0.95rem',
                    padding: 0,
                  }}
                >
                  {c.code}
                </button>
                <button
                  type="button"
                  onClick={() => handleForget(c.code)}
                  aria-label={`${c.code} 잊기`}
                  title="이 코드 잊기"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0 6px',
                    fontSize: '0.9rem',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form action={loginAsKidWithCode} onSubmit={handleSubmit} className="stack-2">
        <input
          type="text"
          name="code"
          placeholder="ABCDEF"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          minLength={6}
          required
          autoComplete="off"
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.4em',
            fontSize: '1.3rem',
            textAlign: 'center',
            fontWeight: 700,
            paddingLeft: '0.4em',
          }}
        />
        <SubmitButton variant="success" pendingText="확인 중...">
          들어가기
        </SubmitButton>
      </form>
    </div>
  );
}
