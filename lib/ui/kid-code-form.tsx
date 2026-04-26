'use client';

import { useEffect, useRef, useState } from 'react';
import { loginAsKidWithCode } from '@/app/(auth)/login/actions';
import { SubmitButton } from './submit-button';

const STORAGE_KEY = 'cls_kid_codes_v3';
const MAX_REMEMBERED = 6;

export type RememberedKid = {
  code: string;
  nickname?: string;
  guardianName?: string;
  lastUsedAt: number;
};

export function loadKidCodes(): RememberedKid[] {
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

export function saveKidCode(code: string, nickname?: string, guardianName?: string) {
  if (typeof window === 'undefined') return;
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return;
  const existing = loadKidCodes();
  const prev = existing.find((c) => c.code === cleaned);
  const merged: RememberedKid = {
    code: cleaned,
    nickname: nickname ?? prev?.nickname,
    guardianName: guardianName ?? prev?.guardianName,
    lastUsedAt: Date.now(),
  };
  const others = existing.filter((c) => c.code !== cleaned);
  const next = [merged, ...others].slice(0, MAX_REMEMBERED);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

function removeKidCode(code: string) {
  if (typeof window === 'undefined') return;
  const next = loadKidCodes().filter((c) => c.code !== code);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function KidCodeForm() {
  const [remembered, setRemembered] = useState<RememberedKid[]>([]);
  const [code, setCode] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setRemembered(loadKidCodes());
  }, []);

  function handleChip(c: string) {
    setCode(c);
    setTimeout(() => formRef.current?.requestSubmit(), 50);
  }

  function handleForget(c: string) {
    removeKidCode(c);
    setRemembered(loadKidCodes());
  }

  function handleSubmit() {
    if (code.trim().length === 6) saveKidCode(code);
  }

  return (
    <div className="stack-3">
      {remembered.length > 0 && (
        <div>
          <div className="soft" style={{ marginBottom: 8 }}>📌 저장된 자녀 — 눌러서 바로 들어가기</div>
          <div className="stack-2">
            {remembered.map((c) => (
              <div
                key={c.code}
                className="row"
                style={{
                  background: 'var(--experiment-bg)',
                  border: '1px solid var(--experiment)',
                  borderRadius: 'var(--r-md)',
                  paddingRight: 4,
                  alignItems: 'stretch',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleChip(c.code)}
                  className="row gap-3"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    color: 'var(--experiment-deep)',
                    fontFamily: 'inherit',
                    alignItems: 'center',
                    flex: 1,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>🌱</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', display: 'block' }}>
                      {c.nickname ?? c.code}
                    </span>
                    {c.guardianName && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                        {c.guardianName} 가족
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleForget(c.code)}
                  aria-label={`${c.nickname ?? c.code} 잊기`}
                  title="이 자녀 잊기"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0 12px',
                    fontSize: '0.95rem',
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

      <form ref={formRef} action={loginAsKidWithCode} onSubmit={handleSubmit} className="stack-2">
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
